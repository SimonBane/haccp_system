"use client";

import {
  createEquipmentSchema,
  equipmentResponseSchema,
  updateEquipmentSchema,
  type EquipmentFieldsInput,
  type UpdateEquipmentInput,
} from "@haccp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@/features/tenant/tenant-provider";
import { ApiRequestError, parseApiError } from "@/lib/api-utils";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function useEquipmentMutations() {
  const { locationId } = useLocation();
  const { fetchJson, fetchApi } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const invalidateEquipment = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.equipment(locationId),
    });
  };

  const create = useMutation({
    mutationFn: async (input: EquipmentFieldsInput) => {
      const payload = createEquipmentSchema.parse({ ...input, locationId });
      return fetchJson("/equipment", equipmentResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateEquipment,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateEquipmentInput;
    }) => {
      updateEquipmentSchema.parse(input);
      return fetchJson(`/equipment/${id}`, equipmentResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    },
    onSuccess: invalidateEquipment,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
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
    },
    onSuccess: invalidateEquipment,
  });

  return { create, update, remove };
}
