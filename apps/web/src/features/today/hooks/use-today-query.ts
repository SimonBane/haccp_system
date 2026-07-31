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
    placeholderData: (previousData, previousQuery) => {
      if (previousQuery?.queryKey[1] !== locationId) {
        return undefined;
      }

      return previousData;
    },
  });
}
