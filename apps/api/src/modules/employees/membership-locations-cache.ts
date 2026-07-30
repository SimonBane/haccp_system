import { z } from "zod";
import { getRedis } from "../../core/redis/client.js";
import { logger } from "../../lib/logger.js";

const KEY_PREFIX = "membership-locations:org:";
const DEFAULT_TTL_SECONDS = 2 * 24 * 60 * 60;

const locationIdsSchema = z.array(z.string().uuid());

function cacheKey(organizationId: string, userDbId: string): string {
  return `${KEY_PREFIX}${organizationId}:user:${userDbId}`;
}

export const membershipLocationsCache = {
  async get(
    organizationId: string,
    userDbId: string,
  ): Promise<string[] | null> {
    try {
      const redis = await getRedis();
      const raw = await redis.get(cacheKey(organizationId, userDbId));

      if (typeof raw !== "string") {
        return null;
      }

      const parsed = locationIdsSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch (err) {
      logger.warn(
        { err, organizationId, userDbId },
        "Membership locations cache get failed",
      );
      return null;
    }
  },

  async set(
    organizationId: string,
    userDbId: string,
    locationIds: string[],
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.set(
        cacheKey(organizationId, userDbId),
        JSON.stringify(locationIds),
        { EX: ttlSeconds },
      );
    } catch (err) {
      logger.warn(
        { err, organizationId, userDbId },
        "Membership locations cache set failed",
      );
    }
  },

  async invalidate(
    organizationId: string,
    userDbId: string,
  ): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.del(cacheKey(organizationId, userDbId));
    } catch (err) {
      logger.warn(
        { err, organizationId, userDbId },
        "Membership locations cache invalidate failed",
      );
    }
  },

  async invalidateForMembership(
    organizationId: string,
    userDbId: string,
  ): Promise<void> {
    await this.invalidate(organizationId, userDbId);
  },
};
