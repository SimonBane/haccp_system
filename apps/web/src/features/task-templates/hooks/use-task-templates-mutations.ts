"use client";

import {
  createTaskTemplateSchema,
  taskTemplateResponseSchema,
  updateTaskTemplateSchema,
  type TaskTemplateFieldsInput,
  type UpdateTaskTemplateInput,
} from "@haccp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@/features/location/location-provider";
import { ApiRequestError, parseApiError } from "@/lib/api-utils";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function useTaskTemplatesMutations() {
  const { locationId } = useLocation();
  const { fetchJson, fetchApi } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const invalidateTaskTemplates = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.taskTemplates(locationId),
    });
  };

  const create = useMutation({
    mutationFn: async (input: TaskTemplateFieldsInput) => {
      const payload = createTaskTemplateSchema.parse({ ...input, locationId });
      return fetchJson("/task-templates", taskTemplateResponseSchema, {
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
      return fetchJson(`/task-templates/${id}`, taskTemplateResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    },
    onSuccess: invalidateTaskTemplates,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchApi(`/task-templates/${id}`, {
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
