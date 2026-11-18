"use client";

import type { TargetTypeResponse } from "@haccp/shared";
import { targetTypeListResponseSchema } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

type UseTargetTypesQueryOptions = {
  initialData?: TargetTypeResponse[];
};

export function useTargetTypesQuery(options?: UseTargetTypesQueryOptions) {
  const { organization } = useTenant();
  const { fetchJson } = useAuthenticatedFetch();

  return useQuery({
    queryKey: queryKeys.targetTypes(organization.id),
    queryFn: async () => {
      const response = await fetchJson(
        "/target-types",
        targetTypeListResponseSchema,
      );
      return response.items;
    },
    initialData: options?.initialData,
  });
}
