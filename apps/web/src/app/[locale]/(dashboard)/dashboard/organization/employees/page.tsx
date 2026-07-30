import { type Locale } from "@/i18n/routing";
import { listEmployees } from "@/lib/api-client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
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
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <EmployeesManager initialItems={employees.items} />
      </div>
    </>
  );
}
