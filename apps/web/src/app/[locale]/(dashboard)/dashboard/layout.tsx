import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { getLocale } from "next-intl/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TenantProvider } from "@/features/tenant/tenant-provider";
import { redirect } from "@/i18n/navigation";
import { type Locale } from "@/i18n/routing";
import { getTenantContext } from "@/lib/api-client";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { orgId, sessionStatus } = await auth.protect();

  if (sessionStatus !== "pending" && !orgId) {
    redirect({
      href: "/no-organization",
      locale: (await getLocale()) as Locale,
    });
  }

  const tenant = await getTenantContext();

  return (
    <TenantProvider initialTenant={tenant}>
      <DashboardShell>{children}</DashboardShell>
    </TenantProvider>
  );
}
