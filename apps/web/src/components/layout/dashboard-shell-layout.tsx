import type { ReactNode } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TenantProvider } from "@/features/tenant/tenant-provider";
import { getTenantContext } from "@/lib/api-client";

export async function DashboardShellLayout({
  children,
}: {
  children: ReactNode;
}) {
  const tenant = await getTenantContext();

  return (
    <TenantProvider initialTenant={tenant}>
      <DashboardShell>{children}</DashboardShell>
    </TenantProvider>
  );
}
