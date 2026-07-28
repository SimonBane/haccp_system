import { type Locale } from "@/i18n/routing";
import { getTenantContext } from "@/lib/api-client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { OrganizationSettingsForm } from "@/features/organization/organization-settings-form";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("SettingsPage");
  const tenant = await getTenantContext();

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={[
          { label: t("breadcrumbSettings") },
          { label: t("breadcrumb"), current: true },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <OrganizationSettingsForm initialOrganization={tenant.organization} />
      </div>
    </>
  );
}
