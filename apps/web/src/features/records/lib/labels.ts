import {
  RECORD_DISPLAY_STATE,
  RECORD_RESULT,
  RECORD_TIMING,
  type RecordDisplayState,
  type RecordResult,
  type RecordTiming,
} from "@haccp/shared";

export type RecordsBadgeVariant =
  "default" | "secondary" | "destructive" | "success" | "warning" | "outline";

/** Meaning is carried by the label; the variant is only reinforcement. */
export const RECORD_DISPLAY_STATE_VARIANT: Record<
  RecordDisplayState,
  RecordsBadgeVariant
> = {
  [RECORD_DISPLAY_STATE.SUBMITTED]: "success",
  [RECORD_DISPLAY_STATE.MISSED]: "destructive",
  [RECORD_DISPLAY_STATE.VOIDED]: "outline",
  [RECORD_DISPLAY_STATE.OPEN]: "secondary",
};

export const RECORD_RESULT_VARIANT: Record<RecordResult, RecordsBadgeVariant> =
  {
    [RECORD_RESULT.PASS]: "success",
    [RECORD_RESULT.FAIL]: "destructive",
    [RECORD_RESULT.NOT_EVALUATED]: "outline",
  };

export const RECORD_TIMING_VARIANT: Record<RecordTiming, RecordsBadgeVariant> =
  {
    [RECORD_TIMING.ON_TIME]: "secondary",
    [RECORD_TIMING.LATE]: "warning",
    [RECORD_TIMING.NOT_SUBMITTED]: "outline",
    [RECORD_TIMING.NO_DEADLINE]: "outline",
  };

export type RecordsLabels = {
  displayState: Record<RecordDisplayState, string>;
  recordState: Record<"none" | "submitted" | "voided", string>;
  timing: Record<RecordTiming, string>;
  result: Record<RecordResult, string>;
  type: Record<"temperature" | "cleaning" | "other", string>;
};

/** Timing only qualifies an active submission — an Open row's own badge already reads "Open". */
export function showsTiming(
  displayState: RecordDisplayState,
  timing: RecordTiming,
): boolean {
  return (
    displayState === RECORD_DISPLAY_STATE.SUBMITTED &&
    timing !== RECORD_TIMING.NOT_SUBMITTED
  );
}

/** A submitted no-deadline record reads "On time"; an Open row stays "Not submitted" — no record exists yet. */
export function resolvedTiming(item: {
  displayState: RecordDisplayState;
  timing: RecordTiming;
}): RecordTiming {
  return item.timing === RECORD_TIMING.NO_DEADLINE
    ? RECORD_TIMING.ON_TIME
    : item.timing;
}

/** Badge value for the compact grid/mobile views — null when nothing should render. */
export function timingBadgeValue(item: {
  displayState: RecordDisplayState;
  timing: RecordTiming;
}): RecordTiming | null {
  if (!showsTiming(item.displayState, item.timing)) {
    return null;
  }
  return item.timing === RECORD_TIMING.NO_DEADLINE
    ? RECORD_TIMING.ON_TIME
    : item.timing;
}
