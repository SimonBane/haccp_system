import { getTranslations, setRequestLocale } from "next-intl/server";
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

export default async function NewTaskTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { from } = await searchParams;
  const tenant = await getTenantContext();
  const locationId = await resolveActiveLocationId(tenant);
  const [forms, targets, taskTemplates] = await Promise.all([
    listForms(),
    listTargets(locationId),
    typeof from === "string" ? listTaskTemplates(locationId) : null,
  ]);
  const duplicateOf =
    taskTemplates?.items.find((task) => task.id === from) ?? null;
  const t = await getTranslations("TasksPage");

  return (
    <PageContainer width="content" className="min-h-min pb-6">
      <TaskBuilder
        mode={{
          kind: "create",
          duplicateOf,
          duplicateTitle: duplicateOf
            ? t("duplicateSuggestedTitle", { title: duplicateOf.title })
            : null,
        }}
        initialForms={forms.items}
        initialTargets={targets.items}
        initialLocationId={locationId}
      />
    </PageContainer>
  );
}
