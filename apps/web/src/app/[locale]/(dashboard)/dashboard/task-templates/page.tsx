import { type Locale } from "@/i18n/routing";
import { listEquipment, listTaskTemplates } from "@/lib/api-client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { TaskTemplatesManager } from "@/features/task-templates/task-templates-manager";

export default async function TaskTemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("TasksPage");

  const [taskTemplates, equipment] = await Promise.all([
    listTaskTemplates(),
    listEquipment(),
  ]);

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={[
          { label: t("breadcrumbSettings") },
          { label: t("breadcrumb"), current: true },
        ]}
      />
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <TaskTemplatesManager
          initialItems={taskTemplates.items}
          equipment={equipment.items.map((item) => ({
            id: item.id,
            name: item.name,
          }))}
        />
      </div>
    </>
  );
}
