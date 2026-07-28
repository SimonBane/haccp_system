"use client";

import type { ReactNode } from "react";
import type { LocationResponse, TenantContextResponse } from "@haccp/shared";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

const LOCATION_COOKIE = "haccp_location_id";
const LOCATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type TenantContextValue = TenantContextResponse & {
  locationId: string;
  organizationId: string;
  setCurrentLocation: (locationId: string) => void;
  refreshTenant: (tenant: TenantContextResponse) => void;
};

const TenantContext = createContext<TenantContextValue | null>(null);

type TenantProviderProps = {
  initialTenant: TenantContextResponse;
  children: ReactNode;
};

function setLocationCookie(locationId: string) {
  document.cookie = `${LOCATION_COOKIE}=${encodeURIComponent(locationId)}; path=/; max-age=${LOCATION_COOKIE_MAX_AGE}; samesite=lax`;
}

export function TenantProvider({
  initialTenant,
  children,
}: TenantProviderProps) {
  const [tenant, setTenant] = useState(initialTenant);

  const setCurrentLocation = useCallback((locationId: string) => {
    const nextLocation = tenant.locations.find(
      (location) => location.id === locationId,
    );

    if (!nextLocation) {
      return;
    }

    setLocationCookie(locationId);
    setTenant((current) => ({
      ...current,
      currentLocation: nextLocation,
    }));
  }, [tenant.locations]);

  const refreshTenant = useCallback((nextTenant: TenantContextResponse) => {
    setTenant(nextTenant);
  }, []);

  const value = useMemo(
    () => ({
      ...tenant,
      locationId: tenant.currentLocation.id,
      organizationId: tenant.organization.id,
      setCurrentLocation,
      refreshTenant,
    }),
    [tenant, setCurrentLocation, refreshTenant],
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
  const { currentLocation, locationId } = useTenant();

  return {
    location: currentLocation,
    locationId,
  };
}
