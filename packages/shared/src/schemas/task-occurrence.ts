import { z } from "zod";
import type { TemperatureResult } from "./today.js";

export const occurrenceStatusSchema = z.enum(["pending", "completed", "missed"]);

export type OccurrenceStatus = z.infer<typeof occurrenceStatusSchema>;

export const recordTimelinessSchema = z.enum(["on_time", "late"]);

export type RecordTimeliness = z.infer<typeof recordTimelinessSchema>;

export type ActiveRecordCandidate = {
  recordedAt: Date;
  voidedAt: Date | null;
};

/** A voided record does not satisfy its occurrence — reconciliation still protects the row, but status derivation treats it as absent. */
export function isActiveRecord(
  record: ActiveRecordCandidate | null | undefined,
): record is ActiveRecordCandidate {
  return record != null && record.voidedAt === null;
}

export type DerivedOccurrenceState = {
  status: OccurrenceStatus;
  timeliness: RecordTimeliness | null;
};

export function deriveOccurrenceState(params: {
  dueAt: Date;
  now: Date;
  record: ActiveRecordCandidate | null;
}): DerivedOccurrenceState {
  if (!isActiveRecord(params.record)) {
    return {
      status: params.now.getTime() >= params.dueAt.getTime() ? "missed" : "pending",
      timeliness: null,
    };
  }

  return {
    status: "completed",
    timeliness:
      params.record.recordedAt.getTime() <= params.dueAt.getTime()
        ? "on_time"
        : "late",
  };
}

/** The temperature result is read from the stored detail row, never recomputed from a possibly-stale occurrence range. */
export function deriveTemperatureResult(
  detail: { result: TemperatureResult } | null | undefined,
): TemperatureResult | null {
  return detail?.result ?? null;
}

/**
 * availableAt = max(start of the occurrence's local day, scheduled instant minus the opening
 * offset) — a task never opens on the previous local date, however wide the offset.
 */
export function computeAvailableAt(params: {
  scheduledInstant: Date;
  startOfLocalDay: Date;
  completionOpensBeforeMinutes: number;
}): Date {
  const candidate =
    params.scheduledInstant.getTime() -
    params.completionOpensBeforeMinutes * 60_000;

  return new Date(Math.max(params.startOfLocalDay.getTime(), candidate));
}

/** Null completionDueAfterMinutes is the only persisted representation of "Never overdue". */
export function computeDueAt(params: {
  scheduledInstant: Date;
  completionDueAfterMinutes: number | null;
}): Date | null {
  if (params.completionDueAfterMinutes === null) return null;

  return new Date(
    params.scheduledInstant.getTime() +
      params.completionDueAfterMinutes * 60_000,
  );
}
