import { type Locale } from "@/i18n/routing";
import { getTenantContext } from "@/lib/api-client";
import { setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { OrganizationSettingsForm } from "@/features/organization/organization-settings-form";

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const tenant = await getTenantContext();

  return (
    <PageContainer width="narrow">
      <OrganizationSettingsForm initialOrganization={tenant.organization} />
    </PageContainer>
  );
}
