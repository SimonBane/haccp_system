import { getTranslations } from "next-intl/server";
import { StatusPage } from "@/components/layout/status-page";

export default async function RootNotFound() {
  const t = await getTranslations("NotFoundPage");

  return <StatusPage code="404" message={t("description")} />;
}
