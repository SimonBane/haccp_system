import {
  getLocalizedPath,
  RECORDS_REPORT_LAYOUT,
  serializeRecordsExclude,
  type AppLocale,
  type RecordsExcludedItem,
  type RecordsReportLayout,
} from "@haccp/shared";
import type { GridFilterState } from "@/components/ui/data-table/server-grid/types";
import { RECORDS_REPORT_FILTER_KEYS } from "./records-filters";
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
  layout?: RecordsReportLayout;
  /** Items left out of one journal while it still prints its others. */
  exclude?: readonly RecordsExcludedItem[];
}): string {
  const params = new URLSearchParams({
    locationId: input.locationId,
    dateFrom: input.range.dateFrom,
    dateTo: input.range.dateTo,
  });

  for (const key of RECORDS_REPORT_FILTER_KEYS) {
    const values = input.filters[key] ?? [];
    if (values.length > 0) {
      params.set(key, [...values].sort().join(","));
    }
  }

  if (input.exclude && input.exclude.length > 0) {
    params.set("exclude", serializeRecordsExclude(input.exclude));
  }

  if (input.layout && input.layout !== RECORDS_REPORT_LAYOUT.LIST) {
    params.set("layout", input.layout);
  }

  return `${getLocalizedPath(input.locale, RECORDS_REPORT_PATH)}?${params.toString()}`;
}

/** The journals endpoint's query: the print period plus the grid's filters, in the report's canonical form. */
export function buildRecordsJournalsQuery(input: {
  range: RecordsDateRange;
  filters: GridFilterState;
}): string {
  const params = new URLSearchParams({
    dateFrom: input.range.dateFrom,
    dateTo: input.range.dateTo,
  });

  for (const key of RECORDS_REPORT_FILTER_KEYS) {
    const values = input.filters[key] ?? [];
    if (values.length > 0) {
      params.set(key, [...values].sort().join(","));
    }
  }

  return params.toString();
}
