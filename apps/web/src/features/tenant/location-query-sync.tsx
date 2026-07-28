"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTenant } from "@/features/tenant/tenant-provider";
import { isLocationScopedQueryKey } from "@/lib/api/query-keys";

export function LocationQuerySync() {
  const { locationId } = useTenant();
  const queryClient = useQueryClient();
  const previousLocationIdRef = useRef(locationId);

  useEffect(() => {
    if (previousLocationIdRef.current === locationId) {
      return;
    }

    previousLocationIdRef.current = locationId;

    void queryClient.invalidateQueries({
      predicate: (query) => isLocationScopedQueryKey(query.queryKey),
    });
  }, [locationId, queryClient]);

  return null;
}
