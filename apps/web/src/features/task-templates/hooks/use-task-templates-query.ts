"use client";

import type { TaskTemplateResponse } from "@haccp/shared";
import { taskTemplateListResponseSchema } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

type UseTaskTemplatesQueryOptions = {
  initialData?: TaskTemplateResponse[];
};

export function useTaskTemplatesQuery(options?: UseTaskTemplatesQueryOptions) {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();

  return useQuery({
    queryKey: queryKeys.taskTemplates(locationId),
    queryFn: async () => {
      const response = await fetchJson(
        "/task-templates",
        taskTemplateListResponseSchema,
      );
      return response.items;
    },
    initialData: options?.initialData,
  });
}
