"use client";

import type { ReactNode } from "react";
import type { LocationResponse } from "@haccp/shared";
import { createContext, useContext, useMemo } from "react";

type LocationContextValue = {
  location: LocationResponse;
  locationId: string;
};

const LocationContext = createContext<LocationContextValue | null>(null);

type LocationProviderProps = {
  initialLocation: LocationResponse;
  children: ReactNode;
};

export function LocationProvider({
  initialLocation,
  children,
}: LocationProviderProps) {
  const value = useMemo(
    () => ({
      location: initialLocation,
      locationId: initialLocation.id,
    }),
    [initialLocation],
  );

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const context = useContext(LocationContext);

  if (!context) {
    throw new Error("useLocation must be used within a LocationProvider");
  }

  return context;
}
