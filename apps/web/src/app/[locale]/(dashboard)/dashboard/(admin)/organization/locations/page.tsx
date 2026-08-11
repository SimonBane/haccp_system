import { type Locale } from "@/i18n/routing";
import { getTenantContext } from "@/lib/api-client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { LocationsManager } from "@/features/locations/locations-manager";

export default async function OrganizationLocationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("LocationsPage");
  const tenant = await getTenantContext();

  if (!tenant.organization.multipleLocationsEnabled) {
    redirect("/dashboard/organization");
  }

  // tenant.locations is the same list, and getTenantContext is deduped per
  // render — so a second /locations round trip would buy nothing.

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
        <LocationsManager initialItems={tenant.locations} />
      </PageContainer>
    </>
  );
}
