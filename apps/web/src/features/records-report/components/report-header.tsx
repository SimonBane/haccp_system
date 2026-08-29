import { useTranslations } from "next-intl";
import type { ReportFilterSummaryEntry } from "../lib/report-filter-summary";

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-medium">{label}:</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}

export function ReportHeader(props: {
  organizationName: string;
  locationName: string;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  generatedBy: string | null;
  filters: ReportFilterSummaryEntry[];
  recordCount: number;
}) {
  const t = useTranslations("RecordsReportPage");

  return (
    <header className="border-b border-black/20 pb-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-lg font-semibold">{t("brand")}</p>
        <p className="text-xs uppercase tracking-wide">{t("storedNotice")}</p>
      </div>

      <h1 className="mt-1 text-xl font-semibold">{t("title")}</h1>
      <p className="text-sm">
        {t("recordCount", { count: props.recordCount })}
      </p>

      <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
        <HeaderField label={t("organization")} value={props.organizationName} />
        <HeaderField label={t("location")} value={props.locationName} />
        <HeaderField
          label={t("dateRange")}
          value={t("dateRangeValue", {
            dateFrom: props.dateFrom,
            dateTo: props.dateTo,
          })}
        />
        <HeaderField label={t("generatedAt")} value={props.generatedAt} />
        {props.generatedBy !== null && (
          <HeaderField label={t("generatedBy")} value={props.generatedBy} />
        )}
        <HeaderField
          label={t("appliedFilters")}
          value={
            props.filters.length === 0
              ? t("noFilters")
              : props.filters
                  .map((entry) => `${entry.label}: ${entry.values.join(", ")}`)
                  .join(" · ")
          }
        />
      </dl>
    </header>
  );
}
