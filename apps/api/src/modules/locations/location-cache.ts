import { locationResponseSchema, type LocationResponse } from "@haccp/shared";
import { getRedis } from "../../core/redis/client.js";
import { logger } from "../../lib/logger.js";

const KEY_PREFIX = "location:org:";
const DEFAULT_TTL_SECONDS = 2 * 24 * 60 * 60;

function cacheKey(orgId: string): string {
  return `${KEY_PREFIX}${orgId}`;
}

export const locationCache = {
  async get(orgId: string): Promise<LocationResponse | null> {
    try {
      const redis = await getRedis();
      const raw = await redis.get(cacheKey(orgId));

      if (!raw) {
        return null;
      }

      return locationResponseSchema.parse(JSON.parse(raw));
    } catch (err) {
      logger.warn({ err, orgId }, "Redis cache get failed");
      return null;
    }
  },

  async set(
    orgId: string,
    location: LocationResponse,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.set(cacheKey(orgId), JSON.stringify(location), {
        EX: ttlSeconds,
      });
    } catch (err) {
      logger.warn({ err, orgId }, "Redis cache set failed");
    }
  },

  async invalidate(orgId: string): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.del(cacheKey(orgId));
    } catch (err) {
      logger.warn({ err, orgId }, "Redis cache invalidate failed");
    }
  },
};
