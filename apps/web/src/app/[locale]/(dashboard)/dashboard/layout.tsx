import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { getLocale } from "next-intl/server";
import { DashboardShellLayout } from "@/components/layout/dashboard-shell-layout";
import { redirect } from "@/i18n/navigation";
import { type Locale } from "@/i18n/routing";

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

  return <DashboardShellLayout>{children}</DashboardShellLayout>;
}
