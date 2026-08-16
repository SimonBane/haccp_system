"use client";

import {
  createTaskTemplateSchema,
  taskTemplateResponseSchema,
  updateTaskTemplateSchema,
  type TaskTemplateFieldsInput,
  type UpdateTaskTemplateInput,
} from "@haccp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@/features/tenant/tenant-provider";
import { ApiRequestError, parseApiError } from "@/lib/api-utils";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { locationScopedPath } from "@/lib/api/paths";

export function useTaskTemplatesMutations() {
  const { locationId } = useLocation();
  const { fetchJson, fetchApi } = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const taskTemplatesPath = locationScopedPath(locationId, "task-templates");

  const invalidateTaskTemplates = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.taskTemplates(locationId),
    });
    // Templates expand into Today's occurrences; skip this and Today keeps the old plan until reload.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.todayByLocation(locationId),
    });
  };

  const create = useMutation({
    mutationFn: async (input: TaskTemplateFieldsInput) => {
      const payload = createTaskTemplateSchema.parse(input);
      return fetchJson(taskTemplatesPath, taskTemplateResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateTaskTemplates,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateTaskTemplateInput;
    }) => {
      updateTaskTemplateSchema.parse(input);
      return fetchJson(`${taskTemplatesPath}/${id}`, taskTemplateResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    },
    onSuccess: invalidateTaskTemplates,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchApi(`${taskTemplatesPath}/${id}`, {
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
    onSuccess: invalidateTaskTemplates,
  });

  return { create, update, remove };
}
