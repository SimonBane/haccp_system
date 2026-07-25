import { createClient, type RedisClientType } from "redis";
import { env } from "../../env.js";
import { logger } from "../../lib/logger.js";

const redisClient: RedisClientType = createClient({ url: env.REDIS_URL });

redisClient.on("error", (err) => {
  logger.error({ err }, "Redis client error");
});

let connectPromise: Promise<RedisClientType> | null = null;

export async function getRedis(): Promise<RedisClientType> {
  if (redisClient.isOpen) {
    return redisClient;
  }

  connectPromise ??= redisClient.connect().then(() => redisClient);

  return connectPromise;
}

export async function closeRedis(): Promise<void> {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }

  connectPromise = null;
}
