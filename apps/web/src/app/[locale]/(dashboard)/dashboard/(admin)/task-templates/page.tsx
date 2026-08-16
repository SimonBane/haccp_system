import { type Locale } from "@/i18n/routing";
import {
  getTenantContext,
  listEquipment,
  listTaskTemplates,
  resolveActiveLocationId,
} from "@/lib/api-client";
import { setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { TaskTemplatesManager } from "@/features/task-templates/task-templates-manager";

export default async function TaskTemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const tenant = await getTenantContext();
  const locationId = await resolveActiveLocationId(tenant);
  const [taskTemplates, equipment] = await Promise.all([
    listTaskTemplates(locationId),
    listEquipment(locationId),
  ]);

  return (
    <PageContainer width="content">
      <TaskTemplatesManager
        initialItems={taskTemplates.items}
        initialEquipment={equipment.items}
        initialLocationId={locationId}
      />
    </PageContainer>
  );
}
