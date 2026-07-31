import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TenantProvider } from "@/features/tenant/tenant-provider";
import {
  getTenantContext,
  resolveActiveLocationId,
} from "@/lib/api-client";

export async function DashboardShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const tenant = await getTenantContext();
  const initialLocationId = await resolveActiveLocationId(tenant);

  return (
    <TenantProvider initialTenant={tenant} initialLocationId={initialLocationId}>
      <DashboardShell>{children}</DashboardShell>
    </TenantProvider>
  );
}
