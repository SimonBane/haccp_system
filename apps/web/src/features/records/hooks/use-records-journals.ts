"use client";

import { recordsJournalsResponseSchema } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { locationScopedPath } from "@/lib/api/paths";
import { queryKeys } from "@/lib/api/query-keys";

/** The checks with rows in the print dialog's period, under the grid's filters. */
export function useRecordsJournals(input: { query: string; enabled: boolean }) {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();

  return useQuery({
    queryKey: queryKeys.recordsJournals(locationId, input.query),
    queryFn: ({ signal }) =>
      fetchJson(
        `${locationScopedPath(locationId, "records")}/journals?${input.query}`,
        recordsJournalsResponseSchema,
        { signal },
      ),
    enabled: input.enabled,
  });
}
