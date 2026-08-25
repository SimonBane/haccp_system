import {
  RECORDS_RESULT_FILTER_VALUES,
  RECORDS_STATE_FILTER_VALUES,
  RECORDS_TYPE_FILTER_VALUES,
} from "@haccp/shared";
import type { DataTableFilterDefinition } from "@/components/ui/data-table/data-table-filter";
import type { GridFilterState } from "@/components/ui/data-table/server-grid/types";

export const RECORDS_FILTER_KEY = {
  TYPE: "type",
  STATE: "state",
  RESULT: "result",
} as const;

/**
 * A temperature outcome only means something when nothing but temperature rows can
 * match, so the control appears for exactly that selection — not merely when it is one
 * of several types.
 */
export function isTemperatureResultFilterVisible(
  typeValues: readonly string[] | undefined,
): boolean {
  return typeValues?.length === 1 && typeValues[0] === "temperature";
}

/**
 * Result is meaningless outside a pure temperature selection, so widening Type must
 * drop it in the same commit — otherwise the next request carries a stale outcome.
 */
export function shouldClearResultFilter(input: {
  key: string;
  values: readonly string[];
  currentResult: readonly string[] | undefined;
}): boolean {
  return (
    input.key === RECORDS_FILTER_KEY.TYPE &&
    !isTemperatureResultFilterVisible(input.values) &&
    (input.currentResult ?? []).length > 0
  );
}

export type RecordsFilterLabels = {
  type: string;
  state: string;
  result: string;
  typeOptions: Record<(typeof RECORDS_TYPE_FILTER_VALUES)[number], string>;
  stateOptions: Record<(typeof RECORDS_STATE_FILTER_VALUES)[number], string>;
  resultOptions: Record<(typeof RECORDS_RESULT_FILTER_VALUES)[number], string>;
};

/** Labels are translated; the values sent to the API stay canonical. */
export function buildRecordsFilterDefinitions(input: {
  labels: RecordsFilterLabels;
  showResult: boolean;
}): DataTableFilterDefinition[] {
  const definitions: DataTableFilterDefinition[] = [
    {
      key: RECORDS_FILTER_KEY.TYPE,
      label: input.labels.type,
      options: RECORDS_TYPE_FILTER_VALUES.map((value) => ({
        value,
        label: input.labels.typeOptions[value],
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
  ];

  if (input.showResult) {
    definitions.push({
      key: RECORDS_FILTER_KEY.RESULT,
      label: input.labels.result,
      options: RECORDS_RESULT_FILTER_VALUES.map((value) => ({
        value,
        label: input.labels.resultOptions[value],
      })),
    });
  }

  return definitions;
}

export function recordsFilterValues(
  filters: GridFilterState,
  key: string,
): string[] {
  return filters[key] ?? [];
}
