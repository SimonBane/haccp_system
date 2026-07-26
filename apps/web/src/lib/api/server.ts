import "server-only";

import {
  createEquipmentSchema,
  equipmentListResponseSchema,
  equipmentResponseSchema,
  locationResponseSchema,
  taskTemplateListResponseSchema,
  todayResponseSchema,
  updateEquipmentSchema,
  type EquipmentFieldsInput,
  type EquipmentListResponse,
  type EquipmentResponse,
  type LocationResponse,
  type TaskTemplateListResponse,
  type TodayResponse,
  type UpdateEquipmentInput,
} from "@haccp/shared";
import { auth } from "@clerk/nextjs/server";
import { API_BASE_URL, parseApiError } from "./api-utils";

export { parseApiError } from "./api-utils";

export async function fetchApi(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { getToken } = await auth();
  const token = await getToken();

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
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
    throw new Error(error?.message ?? `Request failed with ${response.status}`);
  }

  const body: unknown = await response.json();
  return schema.parse(body);
}

function localTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export async function createEquipment(
  locationId: string,
  input: EquipmentFieldsInput,
): Promise<EquipmentResponse> {
  const payload = createEquipmentSchema.parse({ ...input, locationId });

  return fetchJson("/equipment", equipmentResponseSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateEquipment(
  id: string,
  input: UpdateEquipmentInput,
): Promise<EquipmentResponse> {
  updateEquipmentSchema.parse(input);

  return fetchJson(`/equipment/${id}`, equipmentResponseSchema, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteEquipment(id: string): Promise<void> {
  const response = await fetchApi(`/equipment/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new Error(error?.message ?? `Request failed with ${response.status}`);
  }
}
