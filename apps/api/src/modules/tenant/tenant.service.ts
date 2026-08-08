import type {
  TenantContextResponse,
} from "@haccp/shared";
import { clerkClient } from "../../core/auth/clerk-client.js";
import {
  clerkErrorStatus,
  withClerkTimeout,
} from "../../core/auth/clerk-errors.js";
import type { Db } from "../../core/db/client.js";
import {
  ForbiddenError,
  InternalError,
  ServiceUnavailableError,
} from "../../core/errors/app-errors.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
import { logger } from "../../lib/logger.js";
import { singleFlight } from "../../lib/single-flight.js";
import { toLocationResponse } from "../locations/location.mapper.js";
import {
  DEFAULT_LOCATION_NAME,
  locationRepository,
} from "../locations/location.repository.js";
import { toOrganizationResponse } from "../organizations/organization.mapper.js";
import { organizationRepository } from "../organizations/organization.repository.js";
import {
  buildTenantCacheBlob,
  tenantCache,
  type TenantCacheBlob,
} from "./tenant-cache.js";
import { tenantRepository } from "./tenant.repository.js";

const DEFAULT_ORG_NAME = "Organization";

export type ResolvedTenant = TenantContextResponse & {
  organizationId: string;
};

type ProvisionTenantOptions = {
  name?: string;
  imageUrl?: string;
  hasImage?: boolean;
};

export function toTenantContext(blob: TenantCacheBlob): ResolvedTenant {
  return {
    organization: blob.organization,
    locations: blob.locations,
    organizationId: blob.organization.id,
  };
}

async function loadTenantFromDb(
  db: Db,
  clerkOrgId: string,
): Promise<TenantCacheBlob | null> {
  const tenant = await tenantRepository.findByClerkOrgIdWithLocations(
    db,
    clerkOrgId,
  );

  if (!tenant || tenant.locations.length === 0) {
    return null;
  }

  return buildTenantCacheBlob(
    toOrganizationResponse(tenant.organization),
    tenant.locations.map(toLocationResponse),
  );
}

async function fetchClerkOrganization(clerkOrgId: string) {
  try {
    return await withClerkTimeout(
      clerkClient.organizations.getOrganization({ organizationId: clerkOrgId }),
    );
  } catch (error) {
    // A 404 is authoritative: Clerk cannot mint an org-scoped token for an org it
    // does not have, so this means "not entitled", not "we are behind".
    if (clerkErrorStatus(error) === 404) {
      logger.warn(
        { clerkOrgId },
        "Clerk organization not found during provisioning",
      );
      throw new ForbiddenError("This organization is no longer available");
    }

    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    logger.error({ err: error, clerkOrgId }, "Clerk organization lookup failed");
    throw new ServiceUnavailableError(
      "Could not reach the identity provider. Please try again.",
    );
  }
}

// Repairs whatever state the losing writer collided with: a live row missing its
// default location, or a tombstoned row that Clerk says is still active.
async function reconcileExistingTenant(
  db: Db,
  clerkOrgId: string,
): Promise<TenantCacheBlob> {
  const existing = await organizationRepository.findAnyByClerkOrgId(
    db,
    clerkOrgId,
  );

  if (!existing) {
    throw new InternalError("Failed to provision organization");
  }

  try {
    await db.transaction(async (tx) => {
      if (existing.deletedAt) {
        await organizationRepository.updateById(tx, existing.id, {
          deletedAt: null,
        });
      }

      const currentLocations = await locationRepository.findByOrganizationId(
        tx,
        existing.id,
      );

      // Must stay last: a unique violation aborts the whole transaction, so it has
      // to be allowed to escape rather than be caught with tx still in use.
      if (currentLocations.length === 0) {
        await locationRepository.insert(tx, {
          organizationId: existing.id,
          name: DEFAULT_LOCATION_NAME,
          isDefault: true,
        });
      }
    });
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }
  }

  const blob = await loadTenantFromDb(db, clerkOrgId);

  if (!blob) {
    throw new InternalError("Failed to provision organization");
  }

  return blob;
}

export const tenantService = {
  async provisionTenant(
    db: Db,
    clerkOrgId: string,
    options: ProvisionTenantOptions = {},
  ): Promise<TenantCacheBlob> {
    const {
      name = DEFAULT_ORG_NAME,
      imageUrl = "",
      hasImage = false,
    } = options;

    let blob: TenantCacheBlob;

    try {
      const { organization, location } = await db.transaction(async (tx) => {
        const organization = await organizationRepository.insert(tx, {
          clerkOrgId,
          name,
          imageUrl,
          hasImage,
        });

        const location = await locationRepository.insert(tx, {
          organizationId: organization!.id,
          name: DEFAULT_LOCATION_NAME,
          isDefault: true,
        });

        return { organization, location };
      });

      blob = buildTenantCacheBlob(
        toOrganizationResponse(organization!),
        [toLocationResponse(location!)],
      );
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      // Someone else created it, or a partial row already existed. Either way the
      // winning state is authoritative — adopt it instead of failing.
      blob = await reconcileExistingTenant(db, clerkOrgId);
    }

    await tenantCache.set(clerkOrgId, blob);
    return blob;
  },

  // The only way to resolve a tenant on the request path. Provisions on miss, so
  // a missing or half-built org is repaired rather than surfaced as a 404.
  async ensureTenant(db: Db, clerkOrgId: string): Promise<ResolvedTenant> {
    const cached = await tenantCache.get(clerkOrgId);
    if (cached) {
      return toTenantContext(cached);
    }

    return singleFlight(`tenant:${clerkOrgId}`, async () => {
      const recheck = await tenantCache.get(clerkOrgId);
      if (recheck) {
        return toTenantContext(recheck);
      }

      const existing = await loadTenantFromDb(db, clerkOrgId);
      if (existing) {
        await tenantCache.set(clerkOrgId, existing);
        return toTenantContext(existing);
      }

      const clerkOrg = await fetchClerkOrganization(clerkOrgId);
      const blob = await tenantService.provisionTenant(db, clerkOrgId, {
        name: clerkOrg.name || DEFAULT_ORG_NAME,
        imageUrl: clerkOrg.imageUrl ?? "",
        hasImage: clerkOrg.hasImage ?? false,
      });

      logger.info({ clerkOrgId, action: "jit_tenant_provisioned" }, "Tenant provisioned");
      return toTenantContext(blob);
    });
  },

  async warmCache(db: Db, clerkOrgId: string): Promise<TenantCacheBlob | null> {
    const blob = await loadTenantFromDb(db, clerkOrgId);
    if (!blob) {
      return null;
    }

    await tenantCache.set(clerkOrgId, blob);
    return blob;
  },

  async invalidateCache(clerkOrgId: string): Promise<void> {
    await tenantCache.invalidate(clerkOrgId);
  },
};
