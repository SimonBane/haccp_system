import { type Locale } from "@/i18n/routing";
import { listEquipment } from "@/lib/api-client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { EquipmentManager } from "@/features/equipment/equipment-manager";

export default async function EquipmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("EquipmentPage");

  const equipment = await listEquipment();

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={[
          { label: t("breadcrumbSettings") },
          { label: t("breadcrumb"), current: true },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <EquipmentManager initialItems={equipment.items} />
      </div>
    </>
  );
}
