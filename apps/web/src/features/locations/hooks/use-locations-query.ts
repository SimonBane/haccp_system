"use client";

import type { LocationResponse } from "@haccp/shared";
import { locationListResponseSchema } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

type UseLocationsQueryOptions = {
  initialData?: LocationResponse[];
};

export function useLocationsQuery(options?: UseLocationsQueryOptions) {
  const { organization } = useTenant();
  const { fetchJson } = useAuthenticatedFetch();

  return useQuery({
    queryKey: queryKeys.locations(organization.id),
    queryFn: async () => {
      const response = await fetchJson("/locations", locationListResponseSchema);
      return response.items;
    },
    initialData: options?.initialData,
  });
}
