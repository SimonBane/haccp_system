import { type Locale } from "@/i18n/routing";
import { listLocations } from "@/lib/api-client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { LocationsManager } from "@/features/locations/locations-manager";
import { getTenantContext } from "@/lib/api-client";

export default async function LocationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("LocationsPage");
  const tenant = await getTenantContext();

  if (!tenant.organization.multipleLocationsEnabled) {
    redirect("/dashboard");
  }

  const locations = await listLocations();

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={[
          { label: t("breadcrumbSettings") },
          { label: t("breadcrumb"), current: true },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <LocationsManager initialItems={locations.items} />
      </div>
    </>
  );
}
