import { RedisClient, loadRedisConfig, RedisConfigError } from "./index.js";

let bootPromise: Promise<RedisClient> | null = null;
let shutdownRegistered = false;

/** Idempotent: safe to call from main.ts AND from the auto-run at the bottom. */
export function bootstrapRedis(): Promise<RedisClient> {
  bootPromise ??= doBootstrap();
  return bootPromise;
}

async function doBootstrap(): Promise<RedisClient> {
  let config;
  try {
    config = loadRedisConfig();
  } catch (err) {
    if (err instanceof RedisConfigError) {
      console.error("[main.ts] ❌ Redis config error: " + err.message);
    }
    throw err; // bad config is always fatal — nothing to fall back to
  }

  const redis = RedisClient.init(config);

  try {
    await redis.connect();
    console.log("[main.ts] ✅ Redis connected successfully");
  } catch (err) {
    console.error(
      "[main.ts] ❌ Redis connection failed:",
      err instanceof Error ? err.message : err,
    );

    if (config.required) {
      console.error("[main.ts] REDIS_REQUIRED=true → aborting startup");
      process.exit(1);
    }

    console.warn(
      "[main.ts] ⚠️  Continuing startup without Redis (degraded / cache-less mode)",
    );
  }

  registerGracefulShutdown(redis);
  return redis;
}

export function registerGracefulShutdown(redis: RedisClient): void {
  if (shutdownRegistered) return;
  shutdownRegistered = true;

  const shutdown = async (signal: string) => {
    console.log("[main.ts] Received " + signal + ", shutting down gracefully...");
    try {
      await redis.disconnect();
      console.log("[main.ts] Redis disconnected cleanly");
    } catch (err) {
      console.error("[main.ts] Error during Redis shutdown:", err);
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrapRedis().catch((err) => {
  console.error("[main.ts] Fatal error during startup:", err);
  process.exit(1);
});
