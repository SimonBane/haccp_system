"use client";

import {
  createTaskTemplateSchema,
  taskTemplateListResponseSchema,
  taskTemplateResponseSchema,
  updateTaskTemplateSchema,
  type TaskTemplateFieldsInput,
  type UpdateTaskTemplateInput,
} from "@haccp/shared";
import { useCallback } from "react";
import { useLocation } from "@/features/location/location-provider";
import { ApiRequestError, parseApiError } from "@/lib/api-utils";
import { useAuthenticatedFetch } from "@/lib/api/client";

export function useTaskTemplatesApi() {
  const { locationId } = useLocation();
  const { fetchJson, fetchApi, refresh } = useAuthenticatedFetch();

  const create = useCallback(
    async (input: TaskTemplateFieldsInput) => {
      const payload = createTaskTemplateSchema.parse({ ...input, locationId });
      const result = await fetchJson(
        "/task-templates",
        taskTemplateResponseSchema,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      refresh();
      return result;
    },
    [fetchJson, locationId, refresh],
  );

  const update = useCallback(
    async (id: string, input: UpdateTaskTemplateInput) => {
      updateTaskTemplateSchema.parse(input);
      const result = await fetchJson(
        `/task-templates/${id}`,
        taskTemplateResponseSchema,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      refresh();
      return result;
    },
    [fetchJson, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
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

      refresh();
    },
    [fetchApi, refresh],
  );

  const list = useCallback(async () => {
    return fetchJson("/task-templates", taskTemplateListResponseSchema);
  }, [fetchJson]);

  return { create, update, remove, list };
}
