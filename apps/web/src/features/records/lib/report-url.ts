import { getLocalizedPath, type AppLocale } from "@haccp/shared";
import type { GridFilterState } from "@/components/ui/data-table/server-grid/types";
import { RECORDS_FILTER_KEY } from "./records-filters";
import type { RecordsDateRange } from "./records-grid-config";

export const RECORDS_REPORT_PATH = "/records/print";

/**
 * The report covers the full filtered dataset, so paging and the interactive grid sort
 * are deliberately omitted. Multi-select values use the same canonical comma-separated
 * format as the Records API.
 */
export function buildRecordsReportUrl(input: {
  locale: AppLocale;
  locationId: string;
  range: RecordsDateRange;
  filters: GridFilterState;
}): string {
  const params = new URLSearchParams({
    locationId: input.locationId,
    dateFrom: input.range.dateFrom,
    dateTo: input.range.dateTo,
  });

  for (const key of [
    RECORDS_FILTER_KEY.TYPE,
    RECORDS_FILTER_KEY.STATE,
    RECORDS_FILTER_KEY.RESULT,
  ]) {
    const values = input.filters[key] ?? [];
    if (values.length > 0) {
      params.set(key, [...values].sort().join(","));
    }
  }

  return `${getLocalizedPath(input.locale, RECORDS_REPORT_PATH)}?${params.toString()}`;
}
