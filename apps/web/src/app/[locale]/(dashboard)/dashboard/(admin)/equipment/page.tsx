import { type Locale } from "@/i18n/routing";
import { getTenantContext, listEquipment, resolveActiveLocationId } from "@/lib/api-client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { EquipmentManager } from "@/features/equipment/equipment-manager";

export default async function EquipmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("EquipmentPage");

  const tenant = await getTenantContext();
  const locationId = await resolveActiveLocationId(tenant);
  const equipment = await listEquipment(locationId);

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={[
          { label: t("breadcrumbSettings") },
          { label: t("breadcrumb"), current: true },
        ]}
      />
      <PageContainer width="content">
        <EquipmentManager
          initialItems={equipment.items}
          initialLocationId={locationId}
        />
      </PageContainer>
    </>
  );
}
