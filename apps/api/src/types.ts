import type { OpenAPIHono } from "@hono/zod-openapi";
import type {
  LocationResponse,
  OrganizationResponse,
  TenantContextResponse,
} from "@haccp/shared";
import type { Db } from "./core/db/client.js";

export type AppLocationContext = LocationResponse;
export type AppOrganizationContext = OrganizationResponse;
export type AppTenantContext = TenantContextResponse;

export type AppEnv = {
  Variables: {
    requestId: string;
    userId: string;
    orgId: string | null;
    orgRole: string | null;
    organizationId: string | null;
    db: Db;
    currentOrganization: AppOrganizationContext | undefined;
    tenantLocations: LocationResponse[] | undefined;
    currentLocation: AppLocationContext | undefined;
  };
};

export type AppHono = OpenAPIHono<AppEnv>;
