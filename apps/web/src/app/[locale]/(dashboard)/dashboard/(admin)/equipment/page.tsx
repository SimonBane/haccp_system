import { type Locale } from "@/i18n/routing";
import { getTenantContext, listEquipment, resolveActiveLocationId } from "@/lib/api-client";
import { setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { EquipmentManager } from "@/features/equipment/equipment-manager";

export default async function EquipmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const tenant = await getTenantContext();
  const locationId = await resolveActiveLocationId(tenant);
  const equipment = await listEquipment(locationId);

  return (
    <PageContainer width="content">
      <EquipmentManager
        initialItems={equipment.items}
        initialLocationId={locationId}
      />
    </PageContainer>
  );
}
