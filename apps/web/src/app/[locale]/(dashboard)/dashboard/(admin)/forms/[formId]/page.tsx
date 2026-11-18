import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { FormBuilder } from "@/features/forms/components/builder/form-builder";
import { type Locale } from "@/i18n/routing";
import { getForm } from "@/lib/api-client";

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ locale: string; formId: string }>;
}) {
  const { locale, formId } = await params;
  setRequestLocale(locale as Locale);

  const form = await getForm(formId);
  if (!form) notFound();

  return (
    <PageContainer width="full">
      <FormBuilder key={form.latestVersion.id} mode={{ kind: "edit", form }} />
    </PageContainer>
  );
}
