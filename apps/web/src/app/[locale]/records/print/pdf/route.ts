import {
  RECORDS_REPORT_LAYOUT,
  RECORDS_REPORT_STATUS,
  zonedDateString,
  type MeasurementLimits,
  type MeasurementUnit,
} from "@haccp/shared";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { buildAnswerFormatters } from "@/features/forms/lib/answer-format";
import { formatLimits } from "@/features/forms/lib/measurement";
import {
  formatOccurrenceDate,
  formatRecordInstant,
} from "@/features/records/lib/format";
import { renderJournalPdf } from "@/features/records-report/components/pdf/journal-pdf";
import { toDeviationRows } from "@/features/records-report/lib/deviation-rows";
import { toJournalDocuments } from "@/features/records-report/lib/journal-document";
import {
  parseReportSearchParams,
  reportApiQuery,
} from "@/features/records-report/lib/report-search-params";
import { hasMultipleLocations } from "@/features/tenant/lib/multiple-locations";
import { getRecordsReport, getTenantContext } from "@/lib/api-client";
import { requireOrgAdmin } from "@/lib/auth/require-org-admin";
import { routing } from "@/i18n/routing";

// Fonts are read from disk and the document is built per request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The page receives repeated keys as arrays; the PDF must parse the same link the same way. */
function searchParamsRecord(
  search: URLSearchParams,
): Record<string, string | string[]> {
  const record: Record<string, string | string[]> = {};
  for (const key of new Set(search.keys())) {
    const values = search.getAll(key);
    record[key] = values.length === 1 ? values[0]! : values;
  }
  return record;
}

function plain(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return plain(404, "Not found");
  await requireOrgAdmin();

  const [tenant, t, tForms] = await Promise.all([
    getTenantContext(),
    getTranslations({ locale, namespace: "RecordsReportPage" }),
    getTranslations({ locale, namespace: "Forms" }),
  ]);
  const timeZone = tenant.organization.timezone;

  const parsed = parseReportSearchParams({
    searchParams: searchParamsRecord(new URL(request.url).searchParams),
    locationIds: tenant.locations.map((location) => location.id),
    // Server renders run in UTC on Vercel, so "today" must come from the org zone.
    today: zonedDateString(new Date(), timeZone),
  });
  if (!parsed.ok || parsed.params.layout !== RECORDS_REPORT_LAYOUT.JOURNALS) {
    return plain(400, t("invalid.description"));
  }

  let report;
  try {
    report = await getRecordsReport(
      parsed.params.locationId,
      reportApiQuery(parsed.params),
    );
  } catch {
    return plain(502, t("error.description"));
  }
  if (report.status === RECORDS_REPORT_STATUS.TOO_LARGE) {
    return plain(
      413,
      t("tooLarge.description", { total: report.total, limit: report.limit }),
    );
  }

  const symbol = (unit: MeasurementUnit) => tForms(`units.${unit}.symbol`);
  const format = buildAnswerFormatters({
    locale,
    symbol,
    yes: tForms("answers.yes"),
    no: tForms("answers.no"),
  });
  const limits = (value: MeasurementLimits, unit: MeasurementUnit) =>
    formatLimits(
      value,
      unit,
      locale,
      symbol(unit),
      tForms("measurement.rangeTo"),
    );
  const context = { formVersions: report.formVersions, format, limits };

  const location = tenant.locations.find(
    (candidate) => candidate.id === parsed.params.locationId,
  )!;
  const locationName = hasMultipleLocations(
    tenant.organization,
    tenant.locations,
  )
    ? location.name
    : null;
  const { dateFrom, dateTo } = parsed.params;
  const period = t("dateRangeValue", {
    dateFrom: formatOccurrenceDate(dateFrom),
    dateTo: formatOccurrenceDate(dateTo),
  });
  const generatedAt = formatRecordInstant(report.generatedAt, locale, timeZone);
  const deviations = parsed.params.deviations
    ? toDeviationRows(report.items, context)
    : null;

  const pdf = await renderJournalPdf({
    organization: tenant.organization.name,
    context: [tenant.organization.name, locationName, period]
      .filter(Boolean)
      .join(" · "),
    generatedAt,
    documents: toJournalDocuments(report.items, context),
    deviations,
    labels: {
      documentTitle: `${t("journal.title")} · ${period}`,
      brand: t("brand"),
      title: t("journal.title"),
      position: (index, total) => t("journal.position", { index, total }),
      empty: {
        title: t("empty.title"),
        description: t("empty.description"),
      },
      columns: {
        date: t("columns.date"),
        time: t("columns.time"),
        item: t("columns.item"),
        task: t("columns.task"),
        result: t("columns.result"),
        by: t("columns.by"),
        correctiveAction: t("fields.correctiveAction"),
        whatFailed: t("deviations.whatFailed"),
      },
      status: {
        done: t("status.done"),
        fail: t("status.fail"),
        missed: t("status.missed"),
        open: t("status.open"),
        voided: t("status.voided"),
      },
      lateSuffix: t("lateSuffix"),
      unknownUser: t("unknownUser"),
      entryCount: (count) => t("journal.entryCount", { count }),
      norm: t("journal.norm"),
      noAction: t("deviations.noAction"),
      voidedAt: (time) => t("journal.voidedAt", { time }),
      sheetSummary: (summary) =>
        [
          t("journal.sheetDone", { done: summary.done, total: summary.total }),
          summary.failed > 0
            ? t("journal.sheetFailed", { count: summary.failed })
            : null,
          summary.missed > 0
            ? t("journal.sheetMissed", { count: summary.missed })
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      limit: (limit) => t("deviations.limit", { limit }),
      checkedBy: t("journal.checkedBy"),
      signatureDate: t("journal.signatureDate"),
      page: (page, total) => t("journal.page", { page, total }),
      deviationsTitle: t("deviations.title"),
      deviationsEmpty: t("deviations.empty.description"),
    },
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="haccp-journals-${dateFrom}_${dateTo}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
