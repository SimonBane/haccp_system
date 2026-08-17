import { orgRoleSchema } from "@haccp/shared";
import { z } from "zod";
import { getRedis } from "../../core/redis/client.js";
import { env } from "../../env.js";
import { logger } from "../../lib/logger.js";

const KEY_PREFIX = "membership:clerk:";
// This TTL is the bound on how long a revoked location assignment or role can remain
// usable from cache — it is a security control, not a performance tuning value. See
// MEMBERSHIP_CACHE_TTL_SECONDS in env.ts.
const DEFAULT_TTL_SECONDS = env.MEMBERSHIP_CACHE_TTL_SECONDS;

export const membershipCacheBlobSchema = z.object({
  membershipId: z.uuid(),
  organizationId: z.uuid(),
  userId: z.uuid(),
  role: orgRoleSchema,
  locationIds: z.array(z.uuid()),
});

export type MembershipCacheBlob = z.infer<typeof membershipCacheBlobSchema>;

function cacheKey(clerkOrgId: string, clerkUserId: string): string {
  return `${KEY_PREFIX}${clerkOrgId}:${clerkUserId}`;
}

// Absence means unknown, never "no membership" — do not negatively cache.
export const membershipCache = {
  async get(
    clerkOrgId: string,
    clerkUserId: string,
  ): Promise<MembershipCacheBlob | null> {
    try {
      const redis = await getRedis();
      const raw = await redis.get(cacheKey(clerkOrgId, clerkUserId));

      if (typeof raw !== "string") {
        return null;
      }

      const parsed = membershipCacheBlobSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch (err) {
      logger.warn(
        { err, clerkOrgId, clerkUserId },
        "Membership cache get failed",
      );
      return null;
    }
  },

  async set(
    clerkOrgId: string,
    clerkUserId: string,
    blob: MembershipCacheBlob,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.set(
        cacheKey(clerkOrgId, clerkUserId),
        JSON.stringify(blob),
        { EX: ttlSeconds },
      );
    } catch (err) {
      logger.warn(
        { err, clerkOrgId, clerkUserId },
        "Membership cache set failed",
      );
    }
  },

  async invalidate(
    clerkOrgId: string,
    clerkUserId: string | null,
  ): Promise<void> {
    if (!clerkUserId) {
      return;
    }

    try {
      const redis = await getRedis();
      await redis.del(cacheKey(clerkOrgId, clerkUserId));
    } catch (err) {
      logger.warn(
        { err, clerkOrgId, clerkUserId },
        "Membership cache invalidate failed",
      );
    }
  },
};
