import {
  RECORD_DISPLAY_STATE,
  RECORD_KIND,
  RECORD_TIMING,
  type RecordDisplayState,
  type RecordKind,
  type RecordTiming,
} from "@haccp/shared";

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

/** An on-demand entry has no deadline to be on time for, so it is labelled by kind instead. */
export function isOnDemand(item: { kind: RecordKind }): boolean {
  return item.kind === RECORD_KIND.ON_DEMAND;
}
