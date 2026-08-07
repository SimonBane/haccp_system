import type { ReactNode } from "react";
import { requireOrgAdmin } from "@/lib/auth/require-org-admin";

export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireOrgAdmin();

  return children;
}
