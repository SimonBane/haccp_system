import {
  RECORD_DISPLAY_STATE,
  RECORD_TIMING,
} from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { resolvedTiming, showsTiming } from "./labels";

describe("resolvedTiming", () => {
  it("passes an on-time submission through", () => {
    expect(
      resolvedTiming({
        displayState: RECORD_DISPLAY_STATE.SUBMITTED,
        timing: RECORD_TIMING.ON_TIME,
      }),
    ).toBe(RECORD_TIMING.ON_TIME);
  });

  it("passes a late submission through", () => {
    expect(
      resolvedTiming({
        displayState: RECORD_DISPLAY_STATE.SUBMITTED,
        timing: RECORD_TIMING.LATE,
      }),
    ).toBe(RECORD_TIMING.LATE);
  });

  it("reads a submitted no-deadline record as on time", () => {
    expect(
      resolvedTiming({
        displayState: RECORD_DISPLAY_STATE.SUBMITTED,
        timing: RECORD_TIMING.NO_DEADLINE,
      }),
    ).toBe(RECORD_TIMING.ON_TIME);
  });

  it("keeps an open row as not submitted — no record exists yet", () => {
    expect(
      resolvedTiming({
        displayState: RECORD_DISPLAY_STATE.OPEN,
        timing: RECORD_TIMING.NOT_SUBMITTED,
      }),
    ).toBe(RECORD_TIMING.NOT_SUBMITTED);
  });

  it("keeps a missed row as not submitted", () => {
    expect(
      resolvedTiming({
        displayState: RECORD_DISPLAY_STATE.MISSED,
        timing: RECORD_TIMING.NOT_SUBMITTED,
      }),
    ).toBe(RECORD_TIMING.NOT_SUBMITTED);
  });
});

describe("showsTiming", () => {
  it("is true only for a submitted row with a real timing claim", () => {
    expect(
      showsTiming(RECORD_DISPLAY_STATE.SUBMITTED, RECORD_TIMING.LATE),
    ).toBe(true);
  });

  it("is false for a submitted row that was never actually submitted on paper", () => {
    expect(
      showsTiming(RECORD_DISPLAY_STATE.SUBMITTED, RECORD_TIMING.NOT_SUBMITTED),
    ).toBe(false);
  });

  it("is false for an open row", () => {
    expect(
      showsTiming(RECORD_DISPLAY_STATE.OPEN, RECORD_TIMING.NOT_SUBMITTED),
    ).toBe(false);
  });
});
