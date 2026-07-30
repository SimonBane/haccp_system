import type {
  LocationResponse,
  TenantContextResponse,
} from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import {
  ForbiddenError,
  InternalError,
  NotFoundError,
} from "../../core/errors/app-errors.js";
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

function pickCurrentLocation(
  locations: LocationResponse[],
  defaultLocationId: string,
  requestedLocationId?: string | null,
): LocationResponse {
  if (requestedLocationId) {
    const requested = locations.find(
      (location) => location.id === requestedLocationId,
    );
    if (requested) {
      return requested;
    }
  }

  const defaultLocation = locations.find(
    (location) => location.id === defaultLocationId,
  );

  if (!defaultLocation) {
    throw new InternalError("Default location not found in tenant context");
  }

  return defaultLocation;
}

function toTenantContext(
  blob: TenantCacheBlob,
  requestedLocationId?: string | null,
): ResolvedTenant {
  const currentLocation = pickCurrentLocation(
    blob.locations,
    blob.defaultLocationId,
    requestedLocationId,
  );

  return {
    organization: blob.organization,
    locations: blob.locations,
    currentLocation,
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

    let organization = await organizationRepository.findByClerkOrgId(
      db,
      clerkOrgId,
    );

    if (!organization) {
      const existing = await organizationRepository.findAnyByClerkOrgId(
        db,
        clerkOrgId,
      );

      if (existing?.deletedAt) {
        throw new ForbiddenError("Organization is no longer available");
      }

      organization = await organizationRepository.insert(db, {
        clerkOrgId,
        name,
        imageUrl,
        hasImage,
      });

      if (!organization) {
        throw new InternalError("Failed to create organization");
      }
    }

    let locationRows = await locationRepository.findByOrganizationId(
      db,
      organization.id,
    );

    if (locationRows.length === 0) {
      const created = await locationRepository.insert(db, {
        organizationId: organization.id,
        name: DEFAULT_LOCATION_NAME,
        isDefault: true,
      });

      if (!created) {
        throw new InternalError("Failed to create default location");
      }

      locationRows = [created];
    }

    const blob = buildTenantCacheBlob(
      toOrganizationResponse(organization),
      locationRows.map(toLocationResponse),
    );

    await tenantCache.set(clerkOrgId, blob);
    return blob;
  },

  async resolveTenant(
    db: Db,
    clerkOrgId: string,
    requestedLocationId?: string | null,
  ): Promise<ResolvedTenant> {
    const cached = await tenantCache.get(clerkOrgId);

    if (cached) {
      return toTenantContext(cached, requestedLocationId);
    }

    let blob = await loadTenantFromDb(db, clerkOrgId);

    if (!blob) {
      blob = await tenantService.provisionTenant(db, clerkOrgId);
    } else {
      await tenantCache.set(clerkOrgId, blob);
    }

    return toTenantContext(blob, requestedLocationId);
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

  async getOrganizationByClerkOrgId(db: Db, clerkOrgId: string) {
    const organization = await organizationRepository.findByClerkOrgId(
      db,
      clerkOrgId,
    );

    if (!organization) {
      throw new NotFoundError("Organization not found");
    }

    return toOrganizationResponse(organization);
  },
};
