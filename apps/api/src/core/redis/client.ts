import { createClient, type RedisClientType } from "redis";
import { env } from "../../env.js";
import { logger } from "../../lib/logger.js";

// Bounds the TCP/handshake phase of each (re)connect attempt — node-redis retries
// forever on the default reconnectStrategy, so this only caps one attempt, not the
// overall outage; nothing on the request path ever awaits that overall duration.
const CONNECT_TIMEOUT_MS = 1000;
// Bounds an already-connected-but-stalled command (e.g. a wedged server).
const COMMAND_TIMEOUT_MS = 750;

const redisClient: RedisClientType = createClient({
  url: env.REDIS_URL,
  socket: { connectTimeout: CONNECT_TIMEOUT_MS },
  // Reject immediately while disconnected/reconnecting instead of queuing commands
  // that could otherwise wait indefinitely for a connection that may never return.
  disableOfflineQueue: true,
});

redisClient.on("error", (err) => {
  logger.error({ err }, "Redis client error");
});

let connectPromise: Promise<RedisClientType> | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (redisClient.isOpen) {
    return redisClient;
  }

  // Cleared on failure, or one blip pins every later caller to the same rejected
  // promise for the life of the process — and callers swallow cache errors.
  connectPromise ??= redisClient
    .connect()
    .then(() => redisClient)
    .catch((error: unknown) => {
      connectPromise = null;
      throw error;
    });

  return connectPromise;
}

export async function closeRedis(): Promise<void> {
  if (redisClient.isOpen) {
    await redisClient.close();
  }

  connectPromise = null;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Redis command timed out")), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs a Redis command bounded to COMMAND_TIMEOUT_MS. If the client is not ready,
 * rejects immediately (no wait) and fires a best-effort, un-awaited reconnect via
 * getRedis() so organic traffic drives reconnection without any custom retry loop.
 * Callers already catch-and-swallow failures from getRedis()/direct commands today,
 * so this preserves the same throw-on-failure contract — no new branching needed.
 */
export async function withRedis<T>(
  fn: (client: RedisClientType) => Promise<T>,
): Promise<T> {
  if (!redisClient.isReady) {
    void getRedis().catch(() => {});
    throw new Error("Redis client is not ready");
  }

  return withTimeout(fn(redisClient), COMMAND_TIMEOUT_MS);
}
