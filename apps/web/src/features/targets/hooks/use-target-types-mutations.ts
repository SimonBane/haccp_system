"use client";

import {
  targetTypeInputSchema,
  targetTypeResponseSchema,
  type TargetTypeInput,
} from "@haccp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useTenant } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function useTargetTypesMutations() {
  const { organization } = useTenant();
  const { locationId } = useLocation();
  const { fetchJson, fetchVoid } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const invalidateTypes = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.targetTypes(organization.id),
    });
    // Each target carries its type's name and kind.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.targets(locationId),
    });
  };

  const create = useMutation({
    meta: { handlesError: true },
    mutationFn: async (input: TargetTypeInput) => {
      const payload = targetTypeInputSchema.parse(input);
      return fetchJson("/target-types", targetTypeResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateTypes,
  });

  const update = useMutation({
    meta: { handlesError: true },
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: TargetTypeInput;
    }) => {
      const payload = targetTypeInputSchema.parse(input);
      return fetchJson(`/target-types/${id}`, targetTypeResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateTypes,
  });

  const remove = useMutation({
    meta: { handlesError: true },
    mutationFn: async (id: string) => {
      await fetchVoid(`/target-types/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidateTypes,
  });

  return { create, update, remove };
}
