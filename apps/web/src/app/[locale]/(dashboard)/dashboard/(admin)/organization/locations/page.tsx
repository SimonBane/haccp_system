import { type Locale } from "@/i18n/routing";
import { getTenantContext } from "@/lib/api-client";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { LocationsManager } from "@/features/locations/locations-manager";

export default async function OrganizationLocationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const tenant = await getTenantContext();

  if (!tenant.organization.multipleLocationsEnabled) {
    redirect("/dashboard/organization");
  }

  // tenant.locations is the same list, and getTenantContext is deduped per
  // render — so a second /locations round trip would buy nothing.

  return (
    <PageContainer width="content">
      <LocationsManager initialItems={tenant.locations} />
    </PageContainer>
  );
}
