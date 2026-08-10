import type { OpenAPIHono } from "@hono/zod-openapi";
import type {
  LocationResponse,
  OrganizationResponse,
  TenantContextResponse,
  UserResponse,
} from "@haccp/shared";
import type { Db } from "./core/db/client.js";
import type { MembershipCacheBlob } from "./modules/employees/membership-cache.js";
import type { ResolvedTenant } from "./modules/tenant/tenant.service.js";

export type AppLocationContext = LocationResponse;
export type AppOrganizationContext = OrganizationResponse;
export type AppTenantContext = TenantContextResponse;

export type AppEnv = {
  Variables: {
    requestId: string;
    userId: string;
    user: UserResponse | null;
    orgId: string | null;
    orgRole: string | null;
    tenant: ResolvedTenant | undefined;
    membership: MembershipCacheBlob | undefined;
    assignedLocationIds: string[] | null | undefined;
    db: Db;
    currentLocation: AppLocationContext | undefined;
  };
};

export type AppHono = OpenAPIHono<AppEnv>;
