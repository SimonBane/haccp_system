import { z } from "zod";

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
  detail: { result: "ok" | "out_of_range" } | null | undefined,
): "ok" | "out_of_range" | null {
  return detail?.result ?? null;
}
