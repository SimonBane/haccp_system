import {
  organizationResponseSchema,
  locationResponseSchema,
  type LocationResponse,
  type OrganizationResponse,
} from "@haccp/shared";
import { z } from "zod";
import { withRedis } from "../../core/redis/client.js";
import { logger } from "../../lib/logger.js";

const KEY_PREFIX = "tenant:clerk:";
const DEFAULT_TTL_SECONDS = 2 * 24 * 60 * 60;

export const tenantCacheBlobSchema = z.object({
  organization: organizationResponseSchema,
  locations: z.array(locationResponseSchema),
});

export type TenantCacheBlob = z.infer<typeof tenantCacheBlobSchema>;

function cacheKey(clerkOrgId: string): string {
  return `${KEY_PREFIX}${clerkOrgId}`;
}

export const tenantCache = {
  async get(clerkOrgId: string): Promise<TenantCacheBlob | null> {
    try {
      const raw = await withRedis((client) => client.get(cacheKey(clerkOrgId)));

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
      await withRedis((client) =>
        client.set(cacheKey(clerkOrgId), JSON.stringify(blob), {
          EX: ttlSeconds,
        }),
      );
    } catch (err) {
      logger.warn({ err, clerkOrgId }, "Tenant cache set failed");
    }
  },

  async invalidate(clerkOrgId: string): Promise<void> {
    try {
      await withRedis((client) => client.del(cacheKey(clerkOrgId)));
    } catch (err) {
      logger.warn({ err, clerkOrgId }, "Tenant cache invalidate failed");
    }
  },
};

export function buildTenantCacheBlob(
  organization: OrganizationResponse,
  locations: LocationResponse[],
): TenantCacheBlob {
  if (locations.length === 0) {
    throw new Error("Tenant must have at least one location");
  }

  return {
    organization,
    locations,
  };
}
