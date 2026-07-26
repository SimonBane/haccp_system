import "server-only";

import {
  equipmentListResponseSchema,
  locationResponseSchema,
  taskTemplateListResponseSchema,
  todayResponseSchema,
  type EquipmentListResponse,
  type LocationResponse,
  type TaskTemplateListResponse,
  type TodayResponse,
} from "@haccp/shared";
import { auth } from "@clerk/nextjs/server";
import { localTodayDate } from "@/lib/date";
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

export async function getCurrentLocation(): Promise<LocationResponse> {
  return fetchJson("/locations/current", locationResponseSchema);
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
