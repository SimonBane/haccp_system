"use client";

import {
  createEquipmentSchema,
  equipmentListResponseSchema,
  equipmentResponseSchema,
  updateEquipmentSchema,
  type EquipmentFieldsInput,
  type UpdateEquipmentInput,
} from "@haccp/shared";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useLocation } from "@/features/location/location-provider";
import { parseApiError, API_BASE_URL, ApiRequestError } from "@/lib/api-utils";

async function fetchWithToken(
  getToken: () => Promise<string | null>,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getToken();

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

async function fetchJsonWithToken<T>(
  getToken: () => Promise<string | null>,
  path: string,
  schema: { parse: (data: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const response = await fetchWithToken(getToken, path, init);

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

export function useEquipmentApi() {
  const { getToken } = useAuth();
  const { locationId } = useLocation();
  const router = useRouter();

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const create = useCallback(
    async (input: EquipmentFieldsInput) => {
      const payload = createEquipmentSchema.parse({ ...input, locationId });
      const result = await fetchJsonWithToken(
        getToken,
        "/equipment",
        equipmentResponseSchema,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      refresh();
      return result;
    },
    [getToken, locationId, refresh],
  );

  const update = useCallback(
    async (id: string, input: UpdateEquipmentInput) => {
      updateEquipmentSchema.parse(input);
      const result = await fetchJsonWithToken(
        getToken,
        `/equipment/${id}`,
        equipmentResponseSchema,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      refresh();
      return result;
    },
    [getToken, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const response = await fetchWithToken(getToken, `/equipment/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await parseApiError(response);
        throw new ApiRequestError(
          error?.message ?? `Request failed with ${response.status}`,
          error?.error ?? "UNKNOWN",
        );
      }

      refresh();
    },
    [getToken, refresh],
  );

  const list = useCallback(async () => {
    return fetchJsonWithToken(getToken, "/equipment", equipmentListResponseSchema);
  }, [getToken]);

  return { create, update, remove, list };
}
