import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { TaskBuilder } from "@/features/task-templates/components/builder/task-builder";
import { type Locale } from "@/i18n/routing";
import {
  getTenantContext,
  listForms,
  listTargets,
  listTaskTemplates,
  resolveActiveLocationId,
} from "@/lib/api-client";

export default async function EditTaskTemplatePage({
  params,
}: {
  params: Promise<{ locale: string; taskTemplateId: string }>;
}) {
  const { locale, taskTemplateId } = await params;
  setRequestLocale(locale as Locale);

  const tenant = await getTenantContext();
  const locationId = await resolveActiveLocationId(tenant);
  const [forms, targets, taskTemplates] = await Promise.all([
    listForms(),
    listTargets(locationId),
    listTaskTemplates(locationId),
  ]);
  const task = taskTemplates.items.find((item) => item.id === taskTemplateId);
  if (!task) notFound();

  return (
    <PageContainer width="content" className="min-h-min pb-6">
      <TaskBuilder
        key={task.updatedAt}
        mode={{ kind: "edit", task }}
        initialForms={forms.items}
        initialTargets={targets.items}
        initialLocationId={locationId}
      />
    </PageContainer>
  );
}
