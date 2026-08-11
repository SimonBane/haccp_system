import { type Locale } from "@/i18n/routing";
import {
  getTenantContext,
  listEquipment,
  listTaskTemplates,
  resolveActiveLocationId,
} from "@/lib/api-client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { PageContainer } from "@/components/layout/page-container";
import { TaskTemplatesManager } from "@/features/task-templates/task-templates-manager";

export default async function TaskTemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("TasksPage");

  const tenant = await getTenantContext();
  const locationId = await resolveActiveLocationId(tenant);
  // Genuinely parallel: both need only the location. Equipment is fetched here
  // rather than left to the client because the form's dropdown otherwise fires a
  // request on mount for a dialog that is closed.
  const [taskTemplates, equipment] = await Promise.all([
    listTaskTemplates(locationId),
    listEquipment(locationId),
  ]);

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={[
          { label: t("breadcrumbSettings") },
          { label: t("breadcrumb"), current: true },
        ]}
      />
      <PageContainer width="content">
        <TaskTemplatesManager
          initialItems={taskTemplates.items}
          initialEquipment={equipment.items}
          initialLocationId={locationId}
        />
      </PageContainer>
    </>
  );
}
