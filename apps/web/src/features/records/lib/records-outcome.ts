import {
  RECORD_DISPLAY_STATE,
  RECORD_OUTCOME,
  RECORD_RESULT,
  type RecordItem,
  type RecordOutcome,
} from "@haccp/shared";

export { RECORD_OUTCOME, type RecordOutcome };

/** One word per row: the state and the result together, which is all a reader scans for. */
export function recordOutcome(item: RecordItem): RecordOutcome {
  switch (item.displayState) {
    case RECORD_DISPLAY_STATE.MISSED:
      return RECORD_OUTCOME.MISSED;
    case RECORD_DISPLAY_STATE.VOIDED:
      return RECORD_OUTCOME.VOIDED;
    case RECORD_DISPLAY_STATE.OPEN:
      return RECORD_OUTCOME.OPEN;
    case RECORD_DISPLAY_STATE.SUBMITTED:
      if (item.result === RECORD_RESULT.FAIL) return RECORD_OUTCOME.ATTENTION;
      if (item.result === RECORD_RESULT.PASS) return RECORD_OUTCOME.PASSED;
      return RECORD_OUTCOME.RECORDED;
  }
}

export type RecordOutcomeVariant =
  "success" | "destructive" | "warning" | "outline" | "secondary";

export const RECORD_OUTCOME_VARIANT: Record<
  RecordOutcome,
  RecordOutcomeVariant
> = {
  [RECORD_OUTCOME.PASSED]: "success",
  [RECORD_OUTCOME.ATTENTION]: "destructive",
  [RECORD_OUTCOME.RECORDED]: "secondary",
  [RECORD_OUTCOME.MISSED]: "warning",
  [RECORD_OUTCOME.VOIDED]: "outline",
  [RECORD_OUTCOME.OPEN]: "outline",
};

/** The item is what staff recognise on the floor; a whole-location check falls back to its form. */
export function recordHeading(item: RecordItem): {
  primary: string;
  secondary: string | null;
} {
  return item.targetName
    ? { primary: item.targetName, secondary: item.title }
    : { primary: item.title, secondary: null };
}
