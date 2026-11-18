import { type Locale } from "@/i18n/routing";
import { listForms } from "@/lib/api-client";
import { setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { FormsManager } from "@/features/forms/forms-manager";

export default async function FormsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const forms = await listForms();

  return (
    <PageContainer width="content">
      <FormsManager initialItems={forms.items} />
    </PageContainer>
  );
}
