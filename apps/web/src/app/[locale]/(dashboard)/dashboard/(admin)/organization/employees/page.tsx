import { type Locale } from "@/i18n/routing";
import { listEmployees } from "@/lib/api-client";
import { setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { EmployeesManager } from "@/features/employees/employees-manager";

export default async function OrganizationEmployeesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const employees = await listEmployees();

  return (
    <PageContainer width="content">
      <EmployeesManager initialItems={employees.items} />
    </PageContainer>
  );
}
