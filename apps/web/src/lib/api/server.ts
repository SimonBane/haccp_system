import "server-only";

import {
  employeeListResponseSchema,
  equipmentListResponseSchema,
  locationListResponseSchema,
  taskTemplateListResponseSchema,
  tenantContextResponseSchema,
  todayResponseSchema,
  type EmployeeListResponse,
  type EquipmentListResponse,
  type LocationListResponse,
  type TaskTemplateListResponse,
  type TenantContextResponse,
  type TodayResponse,
} from "@haccp/shared";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { localTodayDate } from "@/lib/date";
import { API_BASE_URL, ApiRequestError, parseApiError } from "./api-utils";

export { parseApiError } from "./api-utils";

const LOCATION_COOKIE = "haccp_location_id";

async function getLocationHeader(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const locationId = cookieStore.get(LOCATION_COOKIE)?.value;

  if (!locationId) {
    return {};
  }

  return { "X-Location-Id": locationId };
}

export async function fetchApi(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { getToken } = await auth();
  const token = await getToken();
  const locationHeader = await getLocationHeader();

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...init?.headers,
      ...locationHeader,
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

export async function getTenantContext(): Promise<TenantContextResponse> {
  return fetchJson("/tenant/current", tenantContextResponseSchema);
}

export async function listLocations(): Promise<LocationListResponse> {
  return fetchJson("/locations", locationListResponseSchema);
}

export async function listEmployees(): Promise<EmployeeListResponse> {
  return fetchJson("/employees", employeeListResponseSchema);
}

export async function listEquipment(): Promise<EquipmentListResponse> {
  return fetchJson("/equipment", equipmentListResponseSchema);
}

export async function listTaskTemplates(): Promise<TaskTemplateListResponse> {
  return fetchJson("/task-templates", taskTemplateListResponseSchema);
}

export async function getToday(date?: string): Promise<TodayResponse> {
  const occurrenceDate = date ?? localTodayDate();
  return fetchJson(
    `/today?date=${encodeURIComponent(occurrenceDate)}`,
    todayResponseSchema,
  );
}
