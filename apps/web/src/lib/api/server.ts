import "server-only";

import {
  employeeListResponseSchema,
  equipmentListResponseSchema,
  locationListResponseSchema,
  recordsListResponseSchema,
  taskTemplateListResponseSchema,
  tenantContextResponseSchema,
  todayResponseSchema,
  type EmployeeListResponse,
  type EquipmentListResponse,
  type LocationListResponse,
  type RecordsListResponse,
  type TaskTemplateListResponse,
  type TenantContextResponse,
  type TodayResponse,
} from "@haccp/shared";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { cache } from "react";

import { LOCATION_COOKIE, resolveLocationId } from "@/lib/location-preference";
import { locationScopedPath } from "./paths";
import { API_BASE_URL, ApiRequestError, parseApiError } from "./api-utils";

export { parseApiError } from "./api-utils";

export async function fetchApi(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { getToken } = await auth();
  const token = await getToken();

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function fetchJson<T>(
  path: string,
  schema: { parse: (data: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const response = await fetchApi(path, init);

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new ApiRequestError(
      error?.message ?? `Request failed with ${response.status}`,
      error?.error ?? "UNKNOWN",
    );
  }

  const body: unknown = await response.json();
  return schema.parse(body);
}

/** Deduped per render: `cache: "no-store"` opts out of Next fetch memoization. */
export const getTenantContext = cache(
  async (): Promise<TenantContextResponse> =>
    fetchJson("/tenant/current", tenantContextResponseSchema),
);

export async function resolveActiveLocationId(
  tenant: TenantContextResponse,
): Promise<string> {
  const cookieStore = await cookies();
  const cookieLocationId = cookieStore.get(LOCATION_COOKIE)?.value;

  return resolveLocationId(tenant.locations, cookieLocationId);
}

export async function listLocations(): Promise<LocationListResponse> {
  return fetchJson("/locations", locationListResponseSchema);
}

export async function listEmployees(): Promise<EmployeeListResponse> {
  return fetchJson("/employees", employeeListResponseSchema);
}

export async function listEquipment(
  locationId: string,
): Promise<EquipmentListResponse> {
  return fetchJson(
    locationScopedPath(locationId, "equipment"),
    equipmentListResponseSchema,
  );
}

export async function listTaskTemplates(
  locationId: string,
): Promise<TaskTemplateListResponse> {
  return fetchJson(
    locationScopedPath(locationId, "task-templates"),
    taskTemplateListResponseSchema,
  );
}

/** `date` is required: this runs in UTC on Vercel, so a local-zone default would discard the SSR payload. */
export async function getToday(
  locationId: string,
  date: string,
): Promise<TodayResponse> {
  return fetchJson(
    `${locationScopedPath(locationId, "today")}?date=${encodeURIComponent(date)}`,
    todayResponseSchema,
  );
}

/** `query` is built by the Records feature so SSR and the grid controller agree byte for byte. */
export async function getRecordsPage(
  locationId: string,
  query: string,
): Promise<RecordsListResponse> {
  return fetchJson(
    `${locationScopedPath(locationId, "records")}?${query}`,
    recordsListResponseSchema,
  );
}
