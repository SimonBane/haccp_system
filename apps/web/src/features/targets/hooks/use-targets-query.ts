"use client";

import type { TargetResponse } from "@haccp/shared";
import { targetListResponseSchema } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { locationScopedPath } from "@/lib/api/paths";

type UseTargetsQueryOptions = {
  initialData?: TargetResponse[];
  initialLocationId?: string;
};

export function useTargetsQuery(options?: UseTargetsQueryOptions) {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();

  const initialData =
    options?.initialData && locationId === options.initialLocationId
      ? options.initialData
      : undefined;

  return useQuery({
    queryKey: queryKeys.targets(locationId),
    queryFn: async () => {
      const response = await fetchJson(
        locationScopedPath(locationId, "targets"),
        targetListResponseSchema,
      );
      return response.items;
    },
    initialData,
  });
}
