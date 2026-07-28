import {
  organizationResponseSchema,
  locationResponseSchema,
  type LocationResponse,
  type OrganizationResponse,
} from "@haccp/shared";
import { z } from "zod";
import { getRedis } from "../../core/redis/client.js";
import { logger } from "../../lib/logger.js";

const KEY_PREFIX = "tenant:clerk:";
const DEFAULT_TTL_SECONDS = 2 * 24 * 60 * 60;

export const tenantCacheBlobSchema = z.object({
  organization: organizationResponseSchema,
  locations: z.array(locationResponseSchema),
  defaultLocationId: z.string().uuid(),
});

export type TenantCacheBlob = z.infer<typeof tenantCacheBlobSchema>;

function cacheKey(clerkOrgId: string): string {
  return `${KEY_PREFIX}${clerkOrgId}`;
}

export const tenantCache = {
  async get(clerkOrgId: string): Promise<TenantCacheBlob | null> {
    try {
      const redis = await getRedis();
      const raw = await redis.get(cacheKey(clerkOrgId));

      if (typeof raw !== "string") {
        return null;
      }

      const parsed = tenantCacheBlobSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch (err) {
      logger.warn({ err, clerkOrgId }, "Tenant cache get failed");
      return null;
    }
  },

  async set(
    clerkOrgId: string,
    blob: TenantCacheBlob,
    ttlSeconds = DEFAULT_TTL_SECONDS,
  ): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.set(cacheKey(clerkOrgId), JSON.stringify(blob), {
        EX: ttlSeconds,
      });
    } catch (err) {
      logger.warn({ err, clerkOrgId }, "Tenant cache set failed");
    }
  },

  async invalidate(clerkOrgId: string): Promise<void> {
    try {
      const redis = await getRedis();
      await redis.del(cacheKey(clerkOrgId));
    } catch (err) {
      logger.warn({ err, clerkOrgId }, "Tenant cache invalidate failed");
    }
  },
};

export function buildTenantCacheBlob(
  organization: OrganizationResponse,
  locations: LocationResponse[],
): TenantCacheBlob {
  const defaultLocation =
    locations.find((location) => location.isDefault) ?? locations[0];

  if (!defaultLocation) {
    throw new Error("Tenant must have at least one location");
  }

  return {
    organization,
    locations,
    defaultLocationId: defaultLocation.id,
  };
}
