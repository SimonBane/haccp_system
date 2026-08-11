import { type Locale } from "@/i18n/routing";
import { listEmployees } from "@/lib/api-client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { EmployeesManager } from "@/features/employees/employees-manager";

export default async function OrganizationEmployeesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("EmployeesPage");
  const employees = await listEmployees();

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={[
          {
            label: t("breadcrumbOrganization"),
            href: "/dashboard/organization",
          },
          { label: t("breadcrumb"), current: true },
        ]}
      />
      <PageContainer width="content">
        <EmployeesManager initialItems={employees.items} />
      </PageContainer>
    </>
  );
}
