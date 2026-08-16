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
import { locationScopedPath } from "@/lib/api/paths";

export function useEquipmentMutations() {
  const { locationId } = useLocation();
  const { fetchJson, fetchApi } = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const equipmentPath = locationScopedPath(locationId, "equipment");

  const invalidateEquipment = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.equipment(locationId),
    });
    // Today denormalises equipment name and temps onto every task.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.todayByLocation(locationId),
    });
  };

  const create = useMutation({
    mutationFn: async (input: EquipmentFieldsInput) => {
      const payload = createEquipmentSchema.parse(input);
      return fetchJson(equipmentPath, equipmentResponseSchema, {
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
      return fetchJson(`${equipmentPath}/${id}`, equipmentResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    },
    onSuccess: invalidateEquipment,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchApi(`${equipmentPath}/${id}`, {
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
