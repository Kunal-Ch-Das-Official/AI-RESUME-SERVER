export class RedisNotInitializedError extends Error {
  constructor() {
    super('RedisClient not initialized. Call RedisClient.init(config) before getInstance().');
    this.name = 'RedisNotInitializedError';
  }
}

export class RedisConnectionError extends Error {
  constructor(cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`Failed to connect to Redis: ${reason}`);
    this.name = 'RedisConnectionError';
    this.cause = cause;
  }
}

export class RedisLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisLockError';
  }
}

export class RedisConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisConfigError';
  }
}