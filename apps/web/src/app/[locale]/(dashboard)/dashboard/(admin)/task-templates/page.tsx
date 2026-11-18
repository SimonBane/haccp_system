import { setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { TaskTemplatesManager } from "@/features/task-templates/task-templates-manager";
import { type Locale } from "@/i18n/routing";
import {
  getTenantContext,
  listForms,
  listTaskTemplates,
  resolveActiveLocationId,
} from "@/lib/api-client";

export default async function TaskTemplatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { saved } = await searchParams;
  const tenant = await getTenantContext();
  const locationId = await resolveActiveLocationId(tenant);
  const [taskTemplates, forms] = await Promise.all([
    listTaskTemplates(locationId),
    listForms(),
  ]);

  return (
    <PageContainer width="content">
      <TaskTemplatesManager
        initialItems={taskTemplates.items}
        initialForms={forms.items}
        initialLocationId={locationId}
        savedId={typeof saved === "string" ? saved : null}
      />
    </PageContainer>
  );
}
