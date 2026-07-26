"use client";

import type { TodayResponse } from "@haccp/shared";
import { todayResponseSchema } from "@haccp/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

type UseTodayQueryOptions = {
  initialData?: TodayResponse;
};

export function useTodayQuery(date: string, options?: UseTodayQueryOptions) {
  const { fetchJson } = useAuthenticatedFetch();

  return useQuery({
    queryKey: queryKeys.today(date),
    queryFn: () =>
      fetchJson(
        `/today?date=${encodeURIComponent(date)}`,
        todayResponseSchema,
      ),
    initialData:
      options?.initialData && options.initialData.date === date
        ? options.initialData
        : undefined,
    placeholderData: keepPreviousData,
  });
}
