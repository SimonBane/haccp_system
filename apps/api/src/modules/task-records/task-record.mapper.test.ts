import { describe, expect, it } from "vitest";
import type { TaskRecord } from "../../core/db/schema/task-records.js";
import { toReadingRows, toTaskRecordResponse } from "./task-record.mapper.js";

const RECORD_ID = "00000000-0000-4000-8000-000000000001";
const OCCURRENCE_ID = "00000000-0000-4000-8000-000000000002";
const USER_ID = "00000000-0000-4000-8000-000000000003";
const OTHER_USER_ID = "00000000-0000-4000-8000-000000000004";
const VERSION_ID = "00000000-0000-4000-8000-000000000005";
const LOCATION_ID = "00000000-0000-4000-8000-000000000006";
const TARGET_ID = "00000000-0000-4000-8000-000000000007";

function makeRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: RECORD_ID,
    occurrenceId: OCCURRENCE_ID,
    formVersionId: VERSION_ID,
    values: { cleaned: { type: "checkbox", value: true } },
    result: "not_evaluated",
    correctiveAction: null,
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
  it("maps an active record with its answers and result", () => {
    expect(toTaskRecordResponse(makeRecord())).toEqual({
      id: RECORD_ID,
      occurrenceId: OCCURRENCE_ID,
      formVersionId: VERSION_ID,
      active: true,
      createdAt: "2026-08-19T08:00:00.000Z",
      createdByUserId: USER_ID,
      recordedAt: "2026-08-19T08:00:00.000Z",
      recordedByUserId: USER_ID,
      voidedAt: null,
      voidedByUserId: null,
      result: "not_evaluated",
      values: { cleaned: { type: "checkbox", value: true } },
      correctiveAction: null,
    });
  });

  it("marks a voided record inactive and reports void attribution", () => {
    const response = toTaskRecordResponse(
      makeRecord({
        voidedAt: new Date("2026-08-19T09:00:00Z"),
        voidedByUserId: OTHER_USER_ID,
      }),
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
    );

    expect(response).not.toHaveProperty("lastEditedAt");
    expect(response).not.toHaveProperty("lastEditedByUserId");
    expect(response).not.toHaveProperty("organizationId");
    expect(response).not.toHaveProperty("locationId");
    expect(response).not.toHaveProperty("voidReason");
    expect(response.recordedAt).toBe("2026-08-19T10:00:00.000Z");
    expect(response.recordedByUserId).toBe(OTHER_USER_ID);
  });
});

describe("toReadingRows", () => {
  const recordedAt = new Date("2026-08-19T08:00:00Z");

  it("writes one typed row per answered measurement, with the limits it was judged against", () => {
    const rows = toReadingRows({
      recordId: RECORD_ID,
      locationId: LOCATION_ID,
      targetId: TARGET_ID,
      recordedAt,
      values: {
        temperature: {
          type: "measurement",
          value: 7.5,
          unit: "celsius",
          min: 0,
          max: 5,
          fails: true,
        },
        ph: {
          type: "measurement",
          value: 4.2,
          unit: "ph",
          min: null,
          max: 4.6,
          fails: false,
        },
        note: { type: "text", value: "Door left open" },
      },
    });

    expect(rows).toEqual([
      {
        taskRecordId: RECORD_ID,
        fieldId: "temperature",
        locationId: LOCATION_ID,
        targetId: TARGET_ID,
        unit: "celsius",
        value: "7.5",
        minValue: "0",
        maxValue: "5",
        fails: true,
        recordedAt,
      },
      {
        taskRecordId: RECORD_ID,
        fieldId: "ph",
        locationId: LOCATION_ID,
        targetId: TARGET_ID,
        unit: "ph",
        value: "4.2",
        minValue: null,
        maxValue: "4.6",
        fails: false,
        recordedAt,
      },
    ]);
  });

  it("skips an empty optional measurement", () => {
    expect(
      toReadingRows({
        recordId: RECORD_ID,
        locationId: LOCATION_ID,
        targetId: null,
        recordedAt,
        values: {
          temperature: {
            type: "measurement",
            value: null,
            unit: "celsius",
            min: 0,
            max: 5,
            fails: false,
          },
        },
      }),
    ).toEqual([]);
  });
});
