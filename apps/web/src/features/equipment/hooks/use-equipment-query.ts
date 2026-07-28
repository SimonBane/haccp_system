"use client";

import type { EquipmentResponse } from "@haccp/shared";
import { equipmentListResponseSchema } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

type UseEquipmentQueryOptions = {
  initialData?: EquipmentResponse[];
  initialLocationId?: string;
};

export function useEquipmentQuery(options?: UseEquipmentQueryOptions) {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();

  const initialData =
    options?.initialData && locationId === options.initialLocationId
      ? options.initialData
      : undefined;

  return useQuery({
    queryKey: queryKeys.equipment(locationId),
    queryFn: async () => {
      const response = await fetchJson("/equipment", equipmentListResponseSchema);
      return response.items;
    },
    initialData,
  });
}

export function useEquipmentOptions() {
  const { data: items = [] } = useEquipmentQuery();

  return items.map((item) => ({
    id: item.id,
    name: item.name,
  }));
}
