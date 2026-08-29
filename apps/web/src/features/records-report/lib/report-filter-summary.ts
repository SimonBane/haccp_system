import type { RecordsReportSearchParams } from "@haccp/shared";
import type { RecordsFilterLabels } from "@/features/records/lib/records-filters";

export type ReportFilterSummaryEntry = {
  label: string;
  values: string[];
};

/**
 * Display only: the canonical query values stay untouched, so translating a label can never
 * change which rows the report covers.
 */
export function buildReportFilterSummary(input: {
  params: RecordsReportSearchParams;
  labels: RecordsFilterLabels;
}): ReportFilterSummaryEntry[] {
  const { params, labels } = input;

  const entries: ReportFilterSummaryEntry[] = [];

  if (params.type) {
    entries.push({
      label: labels.type,
      values: params.type.map((value) => labels.typeOptions[value]),
    });
  }

  if (params.state) {
    entries.push({
      label: labels.state,
      values: params.state.map((value) => labels.stateOptions[value]),
    });
  }

  if (params.result) {
    entries.push({
      label: labels.result,
      values: params.result.map((value) => labels.resultOptions[value]),
    });
  }

  return entries;
}
