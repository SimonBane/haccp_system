"use client";

import type { ReactNode } from "react";
import {
  pickDefaultLocation,
  type LocationResponse,
  type TenantContextResponse,
} from "@haccp/shared";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  buildLocationCookie,
  resolveLocationId,
} from "@/lib/location-preference";

type TenantContextValue = TenantContextResponse & {
  locationId: string;
  selectedLocation: LocationResponse;
  organizationId: string;
  setLocationId: (locationId: string) => void;
  refreshTenant: (tenant: TenantContextResponse) => void;
};

const TenantContext = createContext<TenantContextValue | null>(null);

type TenantProviderProps = {
  initialTenant: TenantContextResponse;
  initialLocationId: string;
  children: ReactNode;
};

function setLocationCookie(locationId: string) {
  document.cookie = buildLocationCookie(locationId);
}

export function TenantProvider({
  initialTenant,
  initialLocationId,
  children,
}: TenantProviderProps) {
  const [tenant, setTenant] = useState(initialTenant);
  const [locationId, setLocationIdState] = useState(initialLocationId);

  const selectedLocation = useMemo(() => {
    return (
      tenant.locations.find((location) => location.id === locationId) ??
      pickDefaultLocation(tenant.locations)
    );
  }, [tenant.locations, locationId]);

  const setLocationId = useCallback(
    (nextLocationId: string) => {
      const nextLocation = tenant.locations.find(
        (location) => location.id === nextLocationId,
      );

      if (!nextLocation) {
        return;
      }

      setLocationCookie(nextLocationId);
      setLocationIdState(nextLocationId);
    },
    [tenant.locations],
  );

  const refreshTenant = useCallback((nextTenant: TenantContextResponse) => {
    setTenant(nextTenant);
    setLocationIdState((currentLocationId) => {
      const nextLocationId = resolveLocationId(
        nextTenant.locations,
        currentLocationId,
      );

      if (nextLocationId !== currentLocationId) {
        setLocationCookie(nextLocationId);
      }

      return nextLocationId;
    });
  }, []);

  const value = useMemo(
    () => ({
      ...tenant,
      locationId: selectedLocation.id,
      selectedLocation,
      organizationId: tenant.organization.id,
      setLocationId,
      refreshTenant,
    }),
    [tenant, selectedLocation, setLocationId, refreshTenant],
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);

  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }

  return context;
}

export function useLocation(): {
  location: LocationResponse;
  locationId: string;
} {
  const { selectedLocation, locationId } = useTenant();

  return {
    location: selectedLocation,
    locationId,
  };
}
