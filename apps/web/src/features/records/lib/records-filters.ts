import {
  RECORDS_OUTCOME_FILTER_VALUES,
  type RecordOutcome,
  type RecordsFilterOption,
  type RecordsFilterOptionsResponse,
} from "@haccp/shared";
import type { DataTableFilterDefinition } from "@/components/ui/data-table/data-table-filter";
import { actorName } from "./format";

/** Keys are the Records API's query parameter names. */
export const RECORDS_FILTER_KEY = {
  CATEGORY: "category",
  FORM: "form",
  TARGET: "target",
  RECORDED_BY: "recordedBy",
  STATE: "state",
  RESULT: "result",
  TIMING: "timing",
  OUTCOME: "outcome",
} as const;

/** Every key the print link carries; `category` stays so an old link still prints what it named. */
export const RECORDS_REPORT_FILTER_KEYS = [
  RECORDS_FILTER_KEY.CATEGORY,
  RECORDS_FILTER_KEY.FORM,
  RECORDS_FILTER_KEY.TARGET,
  RECORDS_FILTER_KEY.RECORDED_BY,
  RECORDS_FILTER_KEY.STATE,
  RECORDS_FILTER_KEY.RESULT,
  RECORDS_FILTER_KEY.TIMING,
] as const;

/** The menus on the page; state, result and timing belong to the outcome tabs instead. */
export const RECORDS_FACET_KEYS = [
  RECORDS_FILTER_KEY.FORM,
  RECORDS_FILTER_KEY.TARGET,
  RECORDS_FILTER_KEY.RECORDED_BY,
] as const;

export type RecordsFacetKey = (typeof RECORDS_FACET_KEYS)[number];

export type RecordsFilterLabels = {
  form: string;
  target: string;
  recordedBy: string;
  status: string;
  statusOptions: Record<RecordOutcome, string>;
  /** Appended to an archived check or item, e.g. "Fridge 2 (archived)". */
  archived: (name: string) => string;
  unknownUser: string;
};

function optionLabel(
  option: RecordsFilterOption,
  labels: RecordsFilterLabels,
): string {
  return option.archived ? labels.archived(option.name) : option.name;
}

/** Labels are translated; the values sent to the API stay canonical. A facet with nothing to choose is left out. */
export function buildRecordsFilterDefinitions(input: {
  labels: RecordsFilterLabels;
  options: RecordsFilterOptionsResponse | undefined;
}): DataTableFilterDefinition[] {
  const { labels, options } = input;
  const status: DataTableFilterDefinition = {
    key: RECORDS_FILTER_KEY.OUTCOME,
    label: labels.status,
    options: RECORDS_OUTCOME_FILTER_VALUES.map((value) => ({
      value,
      label: labels.statusOptions[value],
    })),
  };
  if (!options) return [status];

  const facets: DataTableFilterDefinition[] = [
    {
      key: RECORDS_FILTER_KEY.FORM,
      label: labels.form,
      options: options.forms.map((option) => ({
        value: option.id,
        label: optionLabel(option, labels),
      })),
    },
    {
      key: RECORDS_FILTER_KEY.TARGET,
      label: labels.target,
      options: options.targets.map((option) => ({
        value: option.id,
        label: optionLabel(option, labels),
      })),
    },
    {
      key: RECORDS_FILTER_KEY.RECORDED_BY,
      label: labels.recordedBy,
      options: options.people.map((person) => ({
        value: person.id,
        label: actorName(person) ?? labels.unknownUser,
      })),
    },
  ];
  return [
    ...facets.filter((definition) => definition.options.length > 0),
    status,
  ];
}
