import { type Locale } from "@/i18n/routing";
import { getTenantContext, listTaskTemplates } from "@/lib/api-client";
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

  const tenant = await getTenantContext();
  const taskTemplates = await listTaskTemplates();

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
          initialLocationId={tenant.currentLocation.id}
        />
      </div>
    </>
  );
}
