"use client";

import type { FormResponse } from "@haccp/shared";
import { formListResponseSchema } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

type UseFormsQueryOptions = {
  initialData?: FormResponse[];
};

export function useFormsQuery(options?: UseFormsQueryOptions) {
  const { organization } = useTenant();
  const { fetchJson } = useAuthenticatedFetch();

  return useQuery({
    queryKey: queryKeys.forms(organization.id),
    queryFn: async () => {
      const response = await fetchJson("/forms", formListResponseSchema);
      return response.items;
    },
    initialData: options?.initialData,
  });
}
