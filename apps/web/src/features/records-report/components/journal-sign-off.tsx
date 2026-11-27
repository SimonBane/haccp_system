import { useTranslations } from "next-intl";

/** Left blank for a wet signature: the printed binder is what the inspector reads. */
export function JournalSignOff() {
  const t = useTranslations("RecordsReportPage.journal");

  return (
    <div className="mt-10 grid grid-cols-[2fr_1fr] gap-8 break-inside-avoid">
      {[t("checkedBy"), t("signatureDate")].map((label) => (
        <div key={label} className="flex flex-col gap-1.5 pt-10">
          <div className="border-t border-foreground" />
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}
