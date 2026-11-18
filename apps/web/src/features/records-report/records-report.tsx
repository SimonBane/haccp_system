import {
  RECORDS_REPORT_STATUS,
  type RecordsReportResponse,
  type RecordsReportSearchParams,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import { buildAnswerFormatters } from "@/features/forms/lib/answer-format";
import {
  formatOccurrenceDate,
  formatRecordInstant,
} from "@/features/records/lib/format";
import { ReportActions } from "./components/report-actions";
import { ReportBody } from "./components/report-body";
import { ReportFooter } from "./components/report-footer";
import { ReportHeader } from "./components/report-header";
import { ReportNotice } from "./components/report-notice";
import { toReportRows } from "./lib/report-rows";

export function RecordsReport(props: {
  report: RecordsReportResponse;
  params: RecordsReportSearchParams;
  organizationName: string;
  locationName: string | null;
  generatedBy: string | null;
  locale: string;
  timeZone: string;
  backHref: string;
}) {
  const t = useTranslations("RecordsReportPage");
  const tForms = useTranslations("Forms");

  if (props.report.status === RECORDS_REPORT_STATUS.TOO_LARGE) {
    return (
      <ReportNotice
        title={t("tooLarge.title")}
        description={t("tooLarge.description", {
          total: props.report.total,
          limit: props.report.limit,
        })}
        backLabel={t("tooLarge.back")}
        backHref={props.backHref}
      />
    );
  }

  const rows = toReportRows(props.report.items, {
    formVersions: props.report.formVersions,
    format: buildAnswerFormatters({
      locale: props.locale,
      symbol: (unit) => tForms(`units.${unit}.symbol`),
      yes: tForms("answers.yes"),
      no: tForms("answers.no"),
    }),
  });

  return (
    <div className="flex flex-col gap-4">
      <ReportActions backHref={props.backHref} />

      <ReportHeader
        organizationName={props.organizationName}
        locationName={props.locationName}
        dateFrom={formatOccurrenceDate(props.params.dateFrom)}
        dateTo={formatOccurrenceDate(props.params.dateTo)}
        generatedAt={formatRecordInstant(
          props.report.generatedAt,
          props.locale,
          props.timeZone,
        )}
        generatedBy={props.generatedBy}
        recordCount={props.report.total}
      />

      {rows.length === 0 ? (
        <section className="py-8">
          <h2 className="text-base font-semibold">{t("empty.title")}</h2>
          <p className="text-sm">{t("empty.description")}</p>
        </section>
      ) : (
        <ReportBody rows={rows} />
      )}

      <ReportFooter />
    </div>
  );
}
