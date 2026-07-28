"use client";

import {
  createLocationSchema,
  locationResponseSchema,
  updateLocationSchema,
  type CreateLocationInput,
  type UpdateLocationInput,
} from "@haccp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError, parseApiError } from "@/lib/api-utils";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function useLocationsMutations() {
  const { fetchJson, fetchApi } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const invalidateLocations = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.locations(),
    });
  };

  const create = useMutation({
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
    mutationFn: async (id: string) => {
      const response = await fetchApi(`/locations/${id}`, {
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
    onSuccess: invalidateLocations,
  });

  return { create, update, remove };
}
