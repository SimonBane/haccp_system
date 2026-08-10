"use client";

import type { EquipmentResponse } from "@haccp/shared";
import { equipmentListResponseSchema } from "@haccp/shared";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { locationScopedPath } from "@/lib/api/paths";

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
      const response = await fetchJson(
        locationScopedPath(locationId, "equipment"),
        equipmentListResponseSchema,
      );
      return response.items;
    },
    initialData,
  });
}

/** Equipment reduced to what a form's select needs. */
export function useEquipmentOptions(options?: UseEquipmentQueryOptions) {
  const { data: equipment = [] } = useEquipmentQuery(options);
  return equipment.map((item) => ({
    id: item.id,
    name: item.name,
  }));
}
