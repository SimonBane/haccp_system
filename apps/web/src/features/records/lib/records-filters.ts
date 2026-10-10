import {
  RECORDS_CATEGORY_FILTER_VALUES,
  RECORDS_RESULT_FILTER_VALUES,
  RECORDS_STATE_FILTER_VALUES,
} from "@haccp/shared";
import type { DataTableFilterDefinition } from "@/components/ui/data-table/data-table-filter";
import type { GridFilterState } from "@/components/ui/data-table/server-grid/types";

export const RECORDS_FILTER_KEY = {
  CATEGORY: "category",
  STATE: "state",
  RESULT: "result",
} as const;

export type RecordsFilterLabels = {
  category: string;
  state: string;
  result: string;
  categoryOptions: Record<
    (typeof RECORDS_CATEGORY_FILTER_VALUES)[number],
    string
  >;
  stateOptions: Record<(typeof RECORDS_STATE_FILTER_VALUES)[number], string>;
  resultOptions: Record<(typeof RECORDS_RESULT_FILTER_VALUES)[number], string>;
};

/** Labels are translated; the values sent to the API stay canonical. */
export function buildRecordsFilterDefinitions(input: {
  labels: RecordsFilterLabels;
}): DataTableFilterDefinition[] {
  return [
    {
      key: RECORDS_FILTER_KEY.CATEGORY,
      label: input.labels.category,
      options: RECORDS_CATEGORY_FILTER_VALUES.map((value) => ({
        value,
        label: input.labels.categoryOptions[value],
      })),
    },
    {
      key: RECORDS_FILTER_KEY.STATE,
      label: input.labels.state,
      options: RECORDS_STATE_FILTER_VALUES.map((value) => ({
        value,
        label: input.labels.stateOptions[value],
      })),
    },
    {
      key: RECORDS_FILTER_KEY.RESULT,
      label: input.labels.result,
      options: RECORDS_RESULT_FILTER_VALUES.map((value) => ({
        value,
        label: input.labels.resultOptions[value],
      })),
    },
  ];
}

export function recordsFilterValues(
  filters: GridFilterState,
  key: string,
): string[] {
  return filters[key] ?? [];
}
