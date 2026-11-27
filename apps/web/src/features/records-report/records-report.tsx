import {
  RECORDS_REPORT_LAYOUT,
  RECORDS_REPORT_STATUS,
  type MeasurementLimits,
  type MeasurementUnit,
  type RecordsReportResponse,
  type RecordsReportSearchParams,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { buildAnswerFormatters } from "@/features/forms/lib/answer-format";
import { formatLimits } from "@/features/forms/lib/measurement";
import {
  formatOccurrenceDate,
  formatRecordInstant,
} from "@/features/records/lib/format";
import { DeviationsTable } from "./components/deviations-table";
import { JournalPack } from "./components/journal-pack";
import { ReportActions } from "./components/report-actions";
import { ReportBody } from "./components/report-body";
import { ReportFooter } from "./components/report-footer";
import { ReportHeader } from "./components/report-header";
import { ReportNotice } from "./components/report-notice";
import { toDeviationRows } from "./lib/deviation-rows";
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
  pdfHref: string;
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

  const report = props.report;
  const symbol = (unit: MeasurementUnit) => tForms(`units.${unit}.symbol`);
  const format = buildAnswerFormatters({
    locale: props.locale,
    symbol,
    yes: tForms("answers.yes"),
    no: tForms("answers.no"),
  });

  const dateFrom = formatOccurrenceDate(props.params.dateFrom);
  const dateTo = formatOccurrenceDate(props.params.dateTo);
  const layout = props.params.layout;

  const header = (title: string, countText: string) => (
    <ReportHeader
      organizationName={props.organizationName}
      locationName={props.locationName}
      dateFrom={dateFrom}
      dateTo={dateTo}
      generatedAt={formatRecordInstant(
        report.generatedAt,
        props.locale,
        props.timeZone,
      )}
      generatedBy={props.generatedBy}
      title={title}
      countText={countText}
    />
  );

  const limits = (value: MeasurementLimits, unit: MeasurementUnit) =>
    formatLimits(
      value,
      unit,
      props.locale,
      symbol(unit),
      tForms("measurement.rangeTo"),
    );

  const deviationRows = () =>
    toDeviationRows(report.items, {
      formVersions: report.formVersions,
      format,
      limits,
    });

  let body: ReactNode;
  if (layout === RECORDS_REPORT_LAYOUT.DEVIATIONS) {
    const rows = deviationRows();
    body = (
      <>
        {header(
          t("deviations.title"),
          t("deviations.count", { count: rows.length }),
        )}
        <DeviationsTable rows={rows} />
      </>
    );
  } else {
    const journals = layout === RECORDS_REPORT_LAYOUT.JOURNALS;
    const empty = report.items.length === 0;
    body = (
      <>
        {header(
          journals ? t("journal.title") : t("title"),
          t("recordCount", { count: report.total }),
        )}
        {empty ? (
          <section className="py-8">
            <h2 className="text-base font-semibold">{t("empty.title")}</h2>
            <p className="text-sm">{t("empty.description")}</p>
          </section>
        ) : journals ? (
          <JournalPack
            items={report.items}
            formVersions={report.formVersions}
            format={format}
            limits={limits}
            deviations={props.params.deviations ? deviationRows() : null}
            context={[
              props.organizationName,
              props.locationName,
              t("dateRangeValue", { dateFrom, dateTo }),
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        ) : (
          <ReportBody
            rows={toReportRows(report.items, {
              formVersions: report.formVersions,
              format,
            })}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ReportActions
        backHref={props.backHref}
        pdfHref={
          layout === RECORDS_REPORT_LAYOUT.JOURNALS ? props.pdfHref : null
        }
      />
      {body}
      <ReportFooter />
    </div>
  );
}
