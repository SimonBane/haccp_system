"use client";

import {
  targetInputSchema,
  targetResponseSchema,
  type TargetInput,
} from "@haccp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { locationScopedPath } from "@/lib/api/paths";

export function useTargetsMutations() {
  const { locationId } = useLocation();
  const { fetchJson, fetchVoid } = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const targetsPath = locationScopedPath(locationId, "targets");

  const invalidateTargets = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.targets(locationId),
    });
    // Templates list their targets by name, and Today copies the name onto each task.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.taskTemplates(locationId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.todayByLocation(locationId),
    });
  };

  const create = useMutation({
    meta: { handlesError: true },
    mutationFn: async (input: TargetInput) => {
      const payload = targetInputSchema.parse(input);
      return fetchJson(targetsPath, targetResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateTargets,
  });

  const update = useMutation({
    meta: { handlesError: true },
    mutationFn: async ({ id, input }: { id: string; input: TargetInput }) => {
      const payload = targetInputSchema.parse(input);
      return fetchJson(`${targetsPath}/${id}`, targetResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateTargets,
  });

  const remove = useMutation({
    meta: { handlesError: true },
    mutationFn: async (id: string) => {
      await fetchVoid(`${targetsPath}/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidateTargets,
  });

  return { create, update, remove };
}
