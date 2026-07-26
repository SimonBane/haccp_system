"use client";

import {
  createEquipmentSchema,
  equipmentListResponseSchema,
  equipmentResponseSchema,
  updateEquipmentSchema,
  type EquipmentFieldsInput,
  type UpdateEquipmentInput,
} from "@haccp/shared";
import { useCallback } from "react";
import { useLocation } from "@/features/location/location-provider";
import { ApiRequestError, parseApiError } from "@/lib/api-utils";
import { useAuthenticatedFetch } from "@/lib/api/client";

export function useEquipmentApi() {
  const { locationId } = useLocation();
  const { fetchJson, fetchApi, refresh } = useAuthenticatedFetch();

  const create = useCallback(
    async (input: EquipmentFieldsInput) => {
      const payload = createEquipmentSchema.parse({ ...input, locationId });
      const result = await fetchJson("/equipment", equipmentResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      refresh();
      return result;
    },
    [fetchJson, locationId, refresh],
  );

  const update = useCallback(
    async (id: string, input: UpdateEquipmentInput) => {
      updateEquipmentSchema.parse(input);
      const result = await fetchJson(`/equipment/${id}`, equipmentResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      refresh();
      return result;
    },
    [fetchJson, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      const response = await fetchApi(`/equipment/${id}`, {
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
    [fetchApi, refresh],
  );

  const list = useCallback(async () => {
    return fetchJson("/equipment", equipmentListResponseSchema);
  }, [fetchJson]);

  return { create, update, remove, list };
}
