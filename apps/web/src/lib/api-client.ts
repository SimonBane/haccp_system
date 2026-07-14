import "server-only";

import {
  createEquipmentSchema,
  equipmentListResponseSchema,
  equipmentResponseSchema,
  healthResponseSchema,
  locationResponseSchema,
  updateEquipmentSchema,
  type CreateEquipmentInput,
  type EquipmentListResponse,
  type EquipmentResponse,
  type HealthResponse,
  type LocationResponse,
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

export async function getHealth(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return null;
    }

    const body: unknown = await response.json();
    const parsed = healthResponseSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export type MeResponse = {
  userId: string;
  orgId: string | null;
  orgRole: string | null;
};

export async function getMe(): Promise<MeResponse> {
  return fetchJson("/me", {
    parse: (data) => data as MeResponse,
  });
}

export async function getCurrentLocation(): Promise<LocationResponse> {
  return fetchJson("/locations/current", locationResponseSchema);
}

export async function listEquipment(): Promise<EquipmentListResponse> {
  return fetchJson("/equipment", equipmentListResponseSchema);
}

export async function createEquipment(
  input: CreateEquipmentInput,
): Promise<EquipmentResponse> {
  createEquipmentSchema.parse(input);

  return fetchJson("/equipment", equipmentResponseSchema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
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
