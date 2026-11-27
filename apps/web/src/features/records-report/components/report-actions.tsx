"use client";

import { ArrowLeftIcon, FileDownIcon, PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Screen-only chrome: `print:hidden` keeps the controls out of the printed document. */
export function ReportActions({
  backHref,
  pdfHref,
}: {
  backHref: string;
  /** Journals print from a server-built PDF; other layouts use the browser's print. */
  pdfHref: string | null;
}) {
  const t = useTranslations("RecordsReportPage.actions");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
      <Button
        variant="outline"
        render={<Link href={backHref} />}
        nativeButton={false}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        {t("back")}
      </Button>
      {pdfHref === null ? (
        <Button onClick={() => window.print()}>
          <PrinterIcon data-icon="inline-start" />
          {t("print")}
        </Button>
      ) : (
        <Button
          render={<a href={pdfHref} target="_blank" rel="noopener" />}
          nativeButton={false}
        >
          <FileDownIcon data-icon="inline-start" />
          {t("pdf")}
        </Button>
      )}
    </div>
  );
}
