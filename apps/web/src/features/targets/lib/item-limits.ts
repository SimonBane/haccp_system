import {
  DEFAULT_MEASUREMENT_PARAMETER,
  ITEM_RANGE_PARAMETERS,
  MEASUREMENT_PARAMETER_VALUES,
  checkMeasurementLimits,
  parameterUnit,
  type ItemLimits,
  type LimitsIssue,
  type MeasurementLimits,
  type MeasurementParameter,
  type MeasurementUnit,
} from "@haccp/shared";
import {
  formatMeasurementDraft,
  parseMeasurementDraft,
} from "@/features/forms/lib/measurement";

/** One "Allowed range" row as typed; both boxes empty means the item keeps the form's default for that measurement. */
export type RangeDraft = {
  parameter: MeasurementParameter;
  min: string;
  max: string;
};

export function emptyRange(
  parameter: MeasurementParameter = DEFAULT_MEASUREMENT_PARAMETER,
): RangeDraft {
  return { parameter, min: "", max: "" };
}

/** Stored ranges in catalog order, or one empty temperature row to start from. */
export function rangesFromLimits(
  limits: ItemLimits,
  separator: string,
): RangeDraft[] {
  const drafts = storedRanges(limits).map(({ parameter, unit, range }) => {
    const text = (value: number | null) =>
      value === null ? "" : formatMeasurementDraft(value, separator, unit);
    return { parameter, min: text(range.min), max: text(range.max) };
  });
  return drafts.length > 0 ? drafts : [emptyRange()];
}

/** The first measurement no row uses yet, for "Add another measurement". */
export function nextFreeParameter(
  drafts: readonly RangeDraft[],
): MeasurementParameter | null {
  const used = new Set(drafts.map((draft) => draft.parameter));
  return ITEM_RANGE_PARAMETERS.find((parameter) => !used.has(parameter)) ?? null;
}

function parseBound(raw: string): number | null | "invalid" {
  if (raw.trim() === "") return null;
  return parseMeasurementDraft(raw) ?? "invalid";
}

/** Issues are keyed by row index; a row left empty is dropped, not refused. */
export function limitsFromRanges(drafts: readonly RangeDraft[]): {
  limits: ItemLimits;
  issues: Record<number, LimitsIssue>;
} {
  const limits: ItemLimits = {};
  const issues: Record<number, LimitsIssue> = {};

  drafts.forEach((draft, index) => {
    const min = parseBound(draft.min);
    const max = parseBound(draft.max);
    if (min === "invalid") {
      issues[index] = "min_out_of_range";
      return;
    }
    if (max === "invalid") {
      issues[index] = "max_out_of_range";
      return;
    }
    if (min === null && max === null) return;

    const range: MeasurementLimits = { min, max };
    const [issue] = checkMeasurementLimits(range, parameterUnit(draft.parameter));
    if (issue) {
      issues[index] = issue;
      return;
    }
    limits[draft.parameter] = range;
  });

  return { limits, issues };
}

/** Each stored range in catalog order, for the list's range column. */
export function storedRanges(limits: ItemLimits): {
  parameter: MeasurementParameter;
  unit: MeasurementUnit;
  range: MeasurementLimits;
}[] {
  return MEASUREMENT_PARAMETER_VALUES.flatMap((parameter) => {
    const range = limits[parameter];
    return range ? [{ parameter, unit: parameterUnit(parameter), range }] : [];
  });
}
