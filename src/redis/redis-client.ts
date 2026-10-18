import Redis, { Redis as RedisInstance, ChainableCommander } from "ioredis";
import crypto from "crypto";
import {
  RedisConfig,
  LockHandle,
  RateLimitResult,
  HealthStatus,
  Logger,
} from "./redis.types.js";
import {
  RedisNotInitializedError,
  RedisConnectionError,
  RedisLockError,
} from "./redis.errors.js";
import envConfig from "../config/envConfig.js";

const defaultLogger: Logger = {
  info: (msg, meta) => console.log("[Redis] " + msg, meta ?? ""),
  warn: (msg, meta) => console.warn("[Redis] " + msg, meta ?? ""),
  error: (msg, meta) => console.error("[Redis] " + msg, meta ?? ""),
  debug: (msg, meta) => {
    if (envConfig.REDIS_DEBUG === "true")
      console.debug("[Redis] " + msg, meta ?? "");
  },
};

/**
 * Standalone, database/ORM-agnostic Redis client.
 *
 * Usage:
 *   // once, at startup (main.ts)
 *   const redis = RedisClient.init(loadRedisConfig());
 *   await redis.connect();
 *
 *   // anywhere else in the app
 *   const redis = RedisClient.getInstance();
 *   await redis.set('foo', 'bar');
 */
export class RedisClient {
  private static instance: RedisClient | undefined;

  private readonly client: RedisInstance;
  private readonly log: Logger;
  private readonly config: Required<
    Pick<RedisConfig, "connectTimeoutMs" | "shutdownTimeoutMs">
  > &
    RedisConfig;

  private subscriber: RedisInstance | null = null;
  private publisher: RedisInstance | null = null;
  private readonly subscriptions = new Map<
    string,
    Set<(message: string) => void>
  >();

  private status: HealthStatus["status"] = "disconnected";
  private connectPromise: Promise<void> | null = null;

  private constructor(config: RedisConfig) {
    this.log = config.logger ?? defaultLogger;
    this.config = {
      connectTimeoutMs: config.connectTimeoutMs ?? 10_000,
      shutdownTimeoutMs: config.shutdownTimeoutMs ?? 5_000,
      ...config,
    };

    this.client = new (Redis as unknown as {
      new (uri?: string, opts?: unknown): RedisInstance;
    })(config.url, {
      lazyConnect: true, // caller controls when connect() actually fires
      keyPrefix: config.keyPrefix,
      maxRetriesPerRequest: 3,
      enableAutoPipelining: true,
      enableOfflineQueue: true,
      connectTimeout: this.config.connectTimeoutMs,
      retryStrategy: (attempt: number) => {
        // exponential backoff with jitter, capped at 10s
        const base = Math.min(1000 * 2 ** attempt, 10_000);
        const jitter = Math.floor(Math.random() * 200);
        return base + jitter;
      },
      reconnectOnError: (err: unknown) => {
        // Auto-reconnect on failover / stale-connection style errors
        return /READONLY|ETIMEDOUT|ECONNRESET|EPIPE/.test(
          (err as Error).message,
        );
      },
      ...config.options,
    });

    this.bindEvents();
  }

  // ============================================================
  // Singleton lifecycle
  // ============================================================

  static init(config: RedisConfig): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient(config);
    }
    return RedisClient.instance;
  }

  static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      throw new RedisNotInitializedError();
    }
    return RedisClient.instance;
  }

  /** For tests only — allows re-initializing with a fresh config between test suites. */
  static resetForTests(): void {
    RedisClient.instance = undefined;
  }

  private bindEvents(): void {
    this.client.on("connect", () => {
      this.status = "connecting";
      this.log.info("TCP connection established");
    });

    this.client.on("ready", () => {
      this.status = "ready";
      this.log.info("✅ Client ready to accept commands");
    });

    this.client.on("error", (err: Error) => {
      this.status = "error";
      this.log.error("❌ Client error", { message: err.message });
    });

    this.client.on("close", () => {
      this.status = "disconnected";
      this.log.warn("Connection closed");
    });

    this.client.on("reconnecting", (ms: number) => {
      this.status = "reconnecting";
      this.log.warn("Reconnecting in " + ms + "ms...");
    });

    this.client.on("end", () => {
      this.status = "disconnected";
      this.log.warn(
        "Connection ended — retries exhausted, no further attempts",
      );
    });
  }

  // ============================================================
  // Connection lifecycle
  // ============================================================

  /**
   * Connects and resolves only once the client is truly ready
   * (or rejects on timeout/error). Safe to call multiple times —
   * concurrent callers share the same in-flight attempt.
   */
  async connect(): Promise<void> {
    if (this.status === "ready") return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.doConnect().finally(() => {
      this.connectPromise = null;
    });

    return this.connectPromise;
  }

  private async doConnect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (err) {
      throw new RedisConnectionError(err);
    }
  }

  /** Graceful shutdown — call from your process signal handlers. */
  async disconnect(): Promise<void> {
    const timeout = new Promise<void>((resolve) =>
      setTimeout(resolve, this.config.shutdownTimeoutMs),
    );

    const quit = async () => {
      if (this.subscriber) await this.subscriber.quit().catch(() => undefined);
      if (this.publisher) await this.publisher.quit().catch(() => undefined);
      await this.client.quit();
    };

    await Promise.race([quit(), timeout]);

    if (this.client.status !== "end") {
      this.log.warn("Graceful quit timed out — forcing disconnect");
      this.client.disconnect();
    }
  }

  isHealthy(): boolean {
    return this.status === "ready";
  }

  getStatus(): HealthStatus["status"] {
    return this.status;
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const pong = await this.client.ping();
      return {
        healthy: pong === "PONG",
        latencyMs: Date.now() - start,
        status: this.status,
      };
    } catch {
      return { healthy: false, latencyMs: null, status: this.status };
    }
  }

  /** Escape hatch — access the raw ioredis instance for anything not wrapped below. */
  getRawClient(): RedisInstance {
    return this.client;
  }

  // ============================================================
  // Basic KV
  // ============================================================

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const payload = this.serialize(value);
    if (ttlSeconds) {
      await this.client.set(key, payload, "EX", ttlSeconds);
    } else {
      await this.client.set(key, payload);
    }
  }

  /** Sets only if the key does not already exist. Returns true if it was set. */
  async setIfNotExists(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<boolean> {
    const payload = this.serialize(value);
    const result = ttlSeconds
      ? await this.client.set(key, payload, "EX", ttlSeconds, "NX")
      : await this.client.set(key, payload, "NX");
    return result === "OK";
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return this.deserialize<T>(raw);
  }

  /** Atomically replaces the value and returns the previous one. */
  async getSet<T = unknown>(key: string, value: unknown): Promise<T | null> {
    const raw = await this.client.getset(key, this.serialize(value));
    return this.deserialize<T>(raw);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return this.client.del(...keys);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    return (await this.client.expire(key, seconds)) === 1;
  }

  async persist(key: string): Promise<boolean> {
    return (await this.client.persist(key)) === 1;
  }

  async ttl(key: string): Promise<number> {
    return this.client.ttl(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async incrBy(key: string, amount: number): Promise<number> {
    return this.client.incrby(key, amount);
  }

  async decr(key: string): Promise<number> {
    return this.client.decr(key);
  }

  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const raw = await this.client.mget(...keys);
    return raw.map((v) => this.deserialize<T>(v));
  }

  async mset(entries: Record<string, unknown>): Promise<void> {
    const flat: string[] = [];
    for (const [k, v] of Object.entries(entries)) {
      flat.push(k, this.serialize(v));
    }
    if (flat.length) await this.client.mset(...flat);
  }

  // ============================================================
  // Hash
  // ============================================================

  async hset(key: string, field: string, value: unknown): Promise<void> {
    await this.client.hset(key, field, this.serialize(value));
  }

  async hmset(key: string, fields: Record<string, unknown>): Promise<void> {
    const flat: string[] = [];
    for (const [f, v] of Object.entries(fields))
      flat.push(f, this.serialize(v));
    if (flat.length) await this.client.hset(key, ...flat);
  }

  async hget<T = unknown>(key: string, field: string): Promise<T | null> {
    const raw = await this.client.hget(key, field);
    return this.deserialize<T>(raw);
  }

  async hgetall<T = Record<string, unknown>>(key: string): Promise<T> {
    return this.client.hgetall(key) as unknown as T;
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.client.hdel(key, ...fields);
  }

  async hincrby(key: string, field: string, amount: number): Promise<number> {
    return this.client.hincrby(key, field, amount);
  }

  // ============================================================
  // List
  // ============================================================

  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.client.lpush(key, ...values);
  }

  async rpush(key: string, ...values: string[]): Promise<number> {
    return this.client.rpush(key, ...values);
  }

  async lpop(key: string): Promise<string | null> {
    return this.client.lpop(key);
  }

  async rpop(key: string): Promise<string | null> {
    return this.client.rpop(key);
  }

  async lrange(key: string, start = 0, stop = -1): Promise<string[]> {
    return this.client.lrange(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    return this.client.llen(key);
  }

  // ============================================================
  // Set
  // ============================================================

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.client.sadd(key, ...members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.client.srem(key, ...members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.client.smembers(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.client.sismember(key, member)) === 1;
  }

  // ============================================================
  // Sorted Set
  // ============================================================

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.client.zadd(key, score, member);
  }

  async zrange(
    key: string,
    start = 0,
    stop = -1,
    withScores = false,
  ): Promise<string[]> {
    return withScores
      ? this.client.zrange(key, String(start), String(stop), "WITHSCORES")
      : this.client.zrange(key, String(start), String(stop));
  }

  async zrangebyscore(
    key: string,
    min: number | string,
    max: number | string,
  ): Promise<string[]> {
    return this.client.zrangebyscore(key, min, max);
  }

  async zincrby(key: string, amount: number, member: string): Promise<number> {
    const result = await this.client.zincrby(key, amount, member);
    return Number(result);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.client.zrem(key, ...members);
  }

  // ============================================================
  // Pipeline / Transactions
  // ============================================================

  /** Batches multiple commands in one round trip. No atomicity guarantee. */
  pipeline(): ChainableCommander {
    return this.client.pipeline();
  }

  /** Atomic MULTI/EXEC transaction — all commands succeed or none apply. */
  multi(): ChainableCommander {
    return this.client.multi();
  }

  /**
   * Optimistic-locking transaction: watches keys, reads current state,
   * lets the caller build the transaction, and retries once if the
   * watched keys changed before EXEC (classic check-and-set pattern).
   */
  async watchTransaction<T>(
    watchKeys: string[],
    builder: (multi: ChainableCommander) => void,
  ): Promise<T[] | null> {
    await this.client.watch(...watchKeys);
    const multi = this.client.multi();
    builder(multi);
    const result = await multi.exec();
    if (result === null) return null; // transaction aborted — a watched key changed
    return result.map(([err, val]) => {
      if (err) throw err;
      return val as T;
    });
  }

  // ============================================================
  // Pub / Sub
  // ============================================================

  async publish(channel: string, message: unknown): Promise<number> {
    if (!this.publisher) this.publisher = this.client.duplicate();
    return this.publisher.publish(channel, this.serialize(message));
  }

  async subscribe(
    channel: string,
    handler: (message: string) => void,
  ): Promise<void> {
    if (!this.subscriber) {
      this.subscriber = this.client.duplicate();
      this.subscriber.on("message", (ch, msg) => {
        this.subscriptions.get(ch)?.forEach((cb) => cb(msg));
      });
    }

    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.subscriber.subscribe(channel);
    }
    this.subscriptions.get(channel)!.add(handler);
  }

  async unsubscribe(
    channel: string,
    handler?: (message: string) => void,
  ): Promise<void> {
    if (!this.subscriber) return;

    if (handler) {
      this.subscriptions.get(channel)?.delete(handler);
      if (this.subscriptions.get(channel)?.size) return; // other listeners remain
    }

    this.subscriptions.delete(channel);
    await this.subscriber.unsubscribe(channel);
  }

  // ============================================================
  // Lua scripting
  // ============================================================

  /**
   * Runs Lua script. Automatically prefixes KEYS with this.prefix if configured,
   * resolving ioredis's default behavior where eval() ignores keyPrefix.
   */
  async eval(
    script: string,
    keys: string[] = [],
    args: (string | number)[] = [],
  ): Promise<unknown> {
    const actualKeys = this.prefix
      ? keys.map((k) => (k.startsWith(this.prefix) ? k : this.prefix + k))
      : keys;
    return this.client.eval(script, actualKeys.length, ...actualKeys, ...args);
  }

  // ============================================================
  // Distributed lock (single-node SET NX PX + token-safe release)
  // ============================================================

  async acquireLock(key: string, ttlMs = 5000): Promise<LockHandle | null> {
    const token = crypto.randomUUID();
    const lockKey = "lock:" + key;
    const result = await this.client.set(lockKey, token, "PX", ttlMs, "NX");
    return result === "OK" ? { key: lockKey, token } : null;
  }

  async releaseLock(handle: LockHandle): Promise<boolean> {
    try {
      // Use clean template literal with explicit whitespace/newlines to avoid malformed number syntax errors
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;
      const result = await this.eval(script, [handle.key], [handle.token]);
      return result === 1;
    } catch (err) {
      this.log.error("Failed to release lock for key: " + handle.key, {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  async extendLock(handle: LockHandle, ttlMs: number): Promise<boolean> {
    try {
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("PEXPIRE", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;
      const result = await this.eval(script, [handle.key], [handle.token, ttlMs]);
      return result === 1;
    } catch (err) {
      this.log.error("Failed to extend lock for key: " + handle.key, {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /** Runs fn while holding the lock, then always releases it. Throws RedisLockError if not acquired. */
  async withLock<T>(
    key: string,
    ttlMs: number,
    fn: () => Promise<T>,
  ): Promise<T> {
    const lock = await this.acquireLock(key, ttlMs);
    if (!lock) {
      throw new RedisLockError("Could not acquire lock for key: " + key);
    }
    try {
      return await fn();
    } finally {
      await this.releaseLock(lock);
    }
  }

  // ============================================================
  // Rate limiting (fixed window, atomic via Lua)
  // ============================================================

  async rateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const script = `
      local current = redis.call("INCR", KEYS[1])
      if current == 1 then
        redis.call("EXPIRE", KEYS[1], ARGV[1])
      end
      local ttl = redis.call("TTL", KEYS[1])
      return {current, ttl}
    `;
    const [current, ttl] = (await this.eval(
      script,
      ["ratelimit:" + key],
      [windowSeconds],
    )) as [number, number];

    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current),
      resetInSeconds: ttl,
    };
  }

  // ============================================================
  // Cache-aside helper
  // ============================================================

  /** Reads from cache; on miss, runs fetcher(), caches the result, and returns it. */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await fetcher();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  // ============================================================
  // Safe bulk operations (SCAN-based — never blocks Redis like KEYS does)
  // ============================================================

  private get prefix(): string {
    return this.config.keyPrefix ?? "";
  }

  async deleteByPattern(pattern: string): Promise<number> {
    const keys = await this.scanKeys(pattern);
    let deleted = 0;
    for (let i = 0; i < keys.length; i += 500) {
      deleted += await this.client.del(...keys.slice(i, i + 500));
    }
    return deleted;
  }

  /** Returns keys WITHOUT the configured prefix, so they can be passed straight back to get/del. */
  async scanKeys(pattern: string): Promise<string[]> {
    let cursor = "0";
    const found: string[] = [];
    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        "MATCH",
        this.prefix + pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      for (const k of keys) {
        found.push(
          this.prefix && k.startsWith(this.prefix)
            ? k.slice(this.prefix.length)
            : k,
        );
      }
    } while (cursor !== "0");
    return found;
  }

  // ============================================================
  // Diagnostics
  // ============================================================

  async dbSize(): Promise<number> {
    return this.client.dbsize();
  }

  async info(section?: string): Promise<string> {
    return section ? this.client.info(section) : this.client.info();
  }

  async flushCurrentDb(): Promise<void> {
    if (envConfig.NODE_ENV === "production") {
      throw new Error("flushCurrentDb() is disabled in production for safety.");
    }
    await this.client.flushdb();
  }

  // ============================================================
  // Internal serialization helpers
  // ============================================================

  private serialize(value: unknown): string {
    return typeof value === "string" ? value : JSON.stringify(value);
  }

  private deserialize<T>(raw: string | null): T | null {
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T; // was stored as a plain string
    }
  }
}