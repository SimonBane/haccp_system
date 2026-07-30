import type { UserResponse } from "@haccp/shared";
import { userResponseSchema } from "@haccp/shared";
import { z } from "zod";
import { getRedis } from "../../core/redis/client.js";
import { logger } from "../../lib/logger.js";

const KEY_PREFIX = "user:clerk:";
const DEFAULT_TTL_SECONDS = 2 * 24 * 60 * 60;

export type UserCacheBlob = z.infer<typeof userResponseSchema>;

function cacheKey(clerkUserId: string): string {
  return `${KEY_PREFIX}${clerkUserId}`;
}

export const userCache = {
  async get(clerkUserId: string): Promise<UserCacheBlob | null> {
    try {
      const redis = await getRedis();
      const raw = await redis.get(cacheKey(clerkUserId));

      if (typeof raw !== "string") {
        return null;
      }

      const parsed = userResponseSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch (err) {
      logger.warn({ err, clerkUserId }, "User cache get failed");
      return null;
    }
  },

  async set(
    clerkUserId: string,
    blob: UserCacheBlob,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.set(cacheKey(clerkUserId), JSON.stringify(blob), {
        EX: ttlSeconds,
      });
    } catch (err) {
      logger.warn({ err, clerkUserId }, "User cache set failed");
    }
  },

  async invalidate(clerkUserId: string): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.del(cacheKey(clerkUserId));
    } catch (err) {
      logger.warn({ err, clerkUserId }, "User cache invalidate failed");
    }
  },
};

export function buildUserCacheBlob(user: UserResponse): UserCacheBlob {
  return user;
}
