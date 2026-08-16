"use client";

import type { TodayResponse } from "@haccp/shared";
import { todayResponseSchema } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { locationScopedPath } from "@/lib/api/paths";

type UseTodayQueryOptions = {
  initialData?: TodayResponse;
  initialLocationId?: string;
};

export function useTodayQuery(date: string, options?: UseTodayQueryOptions) {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();

  const initialData =
    options?.initialData &&
    options.initialData.date === date &&
    locationId === options.initialLocationId
      ? options.initialData
      : undefined;

  return useQuery({
    queryKey: queryKeys.today(locationId, date),
    queryFn: () =>
      fetchJson(
        `${locationScopedPath(locationId, "today")}?date=${encodeURIComponent(date)}`,
        todayResponseSchema,
      ),
    initialData,
    // Today is shared across tablets; other lists skip this so a focus refetch
    // cannot clobber rows under an open dialog. No refetchInterval: a poll
    // between optimistic patch and confirm would flash completed rows back.
    refetchOnWindowFocus: true,
    staleTime: 15_000,
    placeholderData: (previousData, previousQuery) => {
      if (previousQuery?.queryKey[1] !== locationId) {
        return undefined;
      }

      return previousData;
    },
  });
}
