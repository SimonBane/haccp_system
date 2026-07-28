"use client";

import type { LocationResponse } from "@haccp/shared";
import { locationListResponseSchema } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

type UseLocationsQueryOptions = {
  initialData?: LocationResponse[];
};

export function useLocationsQuery(options?: UseLocationsQueryOptions) {
  const { fetchJson } = useAuthenticatedFetch();

  return useQuery({
    queryKey: queryKeys.locations(),
    queryFn: async () => {
      const response = await fetchJson("/locations", locationListResponseSchema);
      return response.items;
    },
    initialData: options?.initialData,
  });
}
