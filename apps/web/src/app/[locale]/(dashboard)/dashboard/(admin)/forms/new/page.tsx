import type { StarterForm } from "@haccp/shared";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { FormCreateView } from "@/features/forms/components/create/form-create-view";
import { type Locale } from "@/i18n/routing";
import { getForm } from "@/lib/api-client";

export default async function NewFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const { from } = await searchParams;
  const original = typeof from === "string" ? await getForm(from) : null;
  const t = await getTranslations("FormsPage");

  const duplicateOf: StarterForm | null = original
    ? {
        key: original.id,
        name: t("duplicateSuggestedName", { name: original.name }),
        description: "",
        category: original.category,
        appliesTo: original.appliesTo,
        definition: original.latestVersion.definition,
      }
    : null;

  return (
    <PageContainer width="full">
      <FormCreateView duplicateOf={duplicateOf} />
    </PageContainer>
  );
}
