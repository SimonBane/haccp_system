"use client";

import {
  createLocationSchema,
  locationResponseSchema,
  updateLocationSchema,
  type CreateLocationInput,
  type UpdateLocationInput,
} from "@haccp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function useLocationsMutations() {
  const { organization } = useTenant();
  const { fetchJson, fetchVoid } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const invalidateLocations = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.locations(organization.id),
    });
  };

  const create = useMutation({
    meta: { handlesError: true },
    mutationFn: async (input: CreateLocationInput) => {
      const payload = createLocationSchema.parse(input);
      return fetchJson("/locations", locationResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateLocations,
  });

  const update = useMutation({
    meta: { handlesError: true },
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateLocationInput;
    }) => {
      updateLocationSchema.parse(input);
      return fetchJson(`/locations/${id}`, locationResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    },
    onSuccess: invalidateLocations,
  });

  const remove = useMutation({
    meta: { handlesError: true },
    mutationFn: async (id: string) => {
      await fetchVoid(`/locations/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: invalidateLocations,
  });

  return { create, update, remove };
}
