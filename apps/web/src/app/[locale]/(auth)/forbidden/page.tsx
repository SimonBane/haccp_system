import { type Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { StatusPage } from "@/components/layout/status-page";

export default async function ForbiddenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("ForbiddenPage");

  return <StatusPage code="403" message={t("description")} />;
}
