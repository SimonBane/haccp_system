import type {
  TenantContextResponse,
} from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import {
  ConflictError,
  NotFoundError,
} from "../../core/errors/app-errors.js";
import { isUniqueViolation } from "../../lib/db-errors.js";
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

function toTenantContext(blob: TenantCacheBlob): ResolvedTenant {
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

      const blob = buildTenantCacheBlob(
        toOrganizationResponse(organization!),
        [toLocationResponse(location!)],
      );

      await tenantCache.set(clerkOrgId, blob);
      return blob;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError("Organization already exists");
      }

      throw error;
    }
  },

  async requireTenant(
    db: Db,
    clerkOrgId: string,
  ): Promise<ResolvedTenant> {
    const cached = await tenantCache.get(clerkOrgId);
    if (cached) {
      return toTenantContext(cached);
    }

    const blob = await loadTenantFromDb(db, clerkOrgId);
    if (!blob) {
      throw new NotFoundError("Organization not found");
    }

    await tenantCache.set(clerkOrgId, blob);
    return toTenantContext(blob);
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
