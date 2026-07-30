import type { ReactNode } from "react";
import { DashboardShellLayout } from "@/components/layout/dashboard-shell-layout";
import { requireOrgAdmin } from "@/lib/auth/require-org-admin";

export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireOrgAdmin();

  return <DashboardShellLayout>{children}</DashboardShellLayout>;
}
