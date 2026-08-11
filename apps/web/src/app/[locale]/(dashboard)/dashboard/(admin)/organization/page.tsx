import { type Locale } from "@/i18n/routing";
import { getTenantContext } from "@/lib/api-client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { OrganizationSettingsForm } from "@/features/organization/organization-settings-form";

export default async function OrganizationPage({
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
        breadcrumbs={[{ label: t("breadcrumb"), current: true }]}
      />
      <PageContainer width="narrow">
        <OrganizationSettingsForm initialOrganization={tenant.organization} />
      </PageContainer>
    </>
  );
}
