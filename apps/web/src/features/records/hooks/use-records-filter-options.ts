"use client";

import { recordsFilterOptionsResponseSchema } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { locationScopedPath } from "@/lib/api/paths";
import { queryKeys } from "@/lib/api/query-keys";

/** The checks, items and people the Records filters offer; the grid works without them. */
export function useRecordsFilterOptions() {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();

  return useQuery({
    queryKey: queryKeys.recordsFilterOptions(locationId),
    queryFn: () =>
      fetchJson(
        `${locationScopedPath(locationId, "records")}/filters`,
        recordsFilterOptionsResponseSchema,
      ),
  });
}
