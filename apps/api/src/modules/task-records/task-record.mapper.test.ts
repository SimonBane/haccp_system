import { describe, expect, it } from "vitest";
import type { TaskRecord } from "../../core/db/schema/task-records.js";
import { toTaskRecordResponse } from "./task-record.mapper.js";

const RECORD_ID = "00000000-0000-4000-8000-000000000001";
const OCCURRENCE_ID = "00000000-0000-4000-8000-000000000002";
const USER_ID = "00000000-0000-4000-8000-000000000003";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000004";

function makeRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: RECORD_ID,
    occurrenceId: OCCURRENCE_ID,
    createdAt: new Date("2026-08-19T08:00:00Z"),
    createdByUserId: USER_ID,
    recordedAt: new Date("2026-08-19T08:00:00Z"),
    recordedByUserId: USER_ID,
    voidedAt: null,
    voidedByUserId: null,
    ...overrides,
  };
}

describe("toTaskRecordResponse", () => {
  it("maps an active ordinary record with no temperature detail", () => {
    const response = toTaskRecordResponse(makeRecord(), null);

    expect(response).toEqual({
      id: RECORD_ID,
      occurrenceId: OCCURRENCE_ID,
      active: true,
      createdAt: "2026-08-19T08:00:00.000Z",
      createdByUserId: USER_ID,
      recordedAt: "2026-08-19T08:00:00.000Z",
      recordedByUserId: USER_ID,
      voidedAt: null,
      voidedByUserId: null,
      temperature: null,
    });
  });

  it("maps numeric-string temperature detail fields to numbers", () => {
    const response = toTaskRecordResponse(makeRecord(), {
      recordedC: "3.5",
      minTempC: "0.0",
      maxTempC: "5.0",
      result: "ok",
      correctiveAction: null,
    });

    expect(response.temperature).toEqual({
      recordedC: 3.5,
      minTempC: 0,
      maxTempC: 5,
      result: "ok",
      correctiveAction: null,
    });
  });

  it("marks a voided record inactive and reports void attribution", () => {
    const response = toTaskRecordResponse(
      makeRecord({
        voidedAt: new Date("2026-08-19T09:00:00Z"),
        voidedByUserId: OTHER_USER_ID,
      }),
      null,
    );

    expect(response.active).toBe(false);
    expect(response.voidedAt).toBe("2026-08-19T09:00:00.000Z");
    expect(response.voidedByUserId).toBe(OTHER_USER_ID);
  });

  it("does not expose a separate last-edited attribution — current recordedAt/recordedByUserId is the only value shown", () => {
    const response = toTaskRecordResponse(
      makeRecord({
        recordedAt: new Date("2026-08-19T10:00:00Z"),
        recordedByUserId: OTHER_USER_ID,
      }),
      null,
    );

    expect(response).not.toHaveProperty("lastEditedAt");
    expect(response).not.toHaveProperty("lastEditedByUserId");
    expect(response.recordedAt).toBe("2026-08-19T10:00:00.000Z");
    expect(response.recordedByUserId).toBe(OTHER_USER_ID);
  });
});
