import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { LocationProvider } from "@/features/location/location-provider";
import { getCurrentLocation } from "@/lib/api-client";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const location = await getCurrentLocation();

  return (
    <DashboardShell>
      <LocationProvider initialLocation={location}>{children}</LocationProvider>
    </DashboardShell>
  );
}
