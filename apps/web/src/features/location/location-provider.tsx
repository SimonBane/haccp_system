"use client";

import type { LocationResponse } from "@haccp/shared";
import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

type LocationContextValue = {
  location: LocationResponse;
  locationId: string;
  setLocation: (location: LocationResponse) => void;
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
  const [location, setLocation] = useState(initialLocation);

  return (
    <LocationContext.Provider
      value={{
        location,
        locationId: location.id,
        setLocation,
      }}
    >
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
