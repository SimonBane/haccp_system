import { useTranslations } from "next-intl";

export function ReportFooter() {
  const t = useTranslations("RecordsReportPage.footer");

  return (
    <footer className="mt-6 border-t border-black/20 pt-3 text-xs">
      <p className="font-medium">{t("generatedBy")}</p>
      <p>{t("disclaimer")}</p>
    </footer>
  );
}
