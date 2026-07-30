"use client";

import type { EmployeeResponse } from "@haccp/shared";
import { employeeListResponseSchema } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

type UseEmployeesQueryOptions = {
  initialData?: EmployeeResponse[];
};

export function useEmployeesQuery(options?: UseEmployeesQueryOptions) {
  const { fetchJson } = useAuthenticatedFetch();

  return useQuery({
    queryKey: queryKeys.employees(),
    queryFn: async () => {
      const response = await fetchJson("/employees", employeeListResponseSchema);
      return response.items;
    },
    initialData: options?.initialData,
  });
}
