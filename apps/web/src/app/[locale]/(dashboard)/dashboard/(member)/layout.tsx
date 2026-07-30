import type { ReactNode } from "react";
import { DashboardShellLayout } from "@/components/layout/dashboard-shell-layout";

export default async function MemberDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DashboardShellLayout>{children}</DashboardShellLayout>;
}
