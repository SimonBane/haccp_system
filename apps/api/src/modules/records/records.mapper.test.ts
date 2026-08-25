import { recordItemSchema } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { toRecordItem } from "./records.mapper.js";
import type { RecordRow } from "./records.repository.js";

const OCCURRENCE_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";
const EQUIPMENT_ID = "33333333-3333-4333-8333-333333333333";
const RECORD_ID = "44444444-4444-4444-8444-444444444444";
const CREATOR_ID = "55555555-5555-4555-8555-555555555555";
const RECORDER_ID = "66666666-6666-4666-8666-666666666666";
const VOIDER_ID = "77777777-7777-4777-8777-777777777777";

const DUE_AT = new Date("2026-08-23T05:00:00.000Z");

function row(overrides: Partial<RecordRow> = {}): RecordRow {
  return {
    occurrenceId: OCCURRENCE_ID,
    taskTemplateId: TEMPLATE_ID,
    occurrenceDate: "2026-08-23",
    scheduledTime: "08:00",
    dueAt: DUE_AT,
    title: "Morning fridge check",
    type: "temperature",
    equipmentId: EQUIPMENT_ID,
    equipmentName: "Fridge 1",
    minTempC: "0.0",
    maxTempC: "5.0",
    recordId: null,
    recordCreatedAt: null,
    recordedAt: null,
    voidedAt: null,
    createdById: null,
    createdByFirstName: null,
    createdByLastName: null,
    recordedById: null,
    recordedByFirstName: null,
    recordedByLastName: null,
    voidedById: null,
    voidedByFirstName: null,
    voidedByLastName: null,
    temperatureRecordedC: null,
    temperatureMinTempC: null,
    temperatureMaxTempC: null,
    temperatureResult: null,
    correctiveAction: null,
    ...overrides,
  };
}

const submittedRecord: Partial<RecordRow> = {
  recordId: RECORD_ID,
  recordCreatedAt: new Date("2026-08-23T04:40:00.000Z"),
  recordedAt: new Date("2026-08-23T04:50:00.000Z"),
  createdById: CREATOR_ID,
  createdByFirstName: "Ada",
  createdByLastName: "Admin",
  recordedById: RECORDER_ID,
  recordedByFirstName: "Emil",
  recordedByLastName: "Employee",
};

const temperatureDetail: Partial<RecordRow> = {
  temperatureRecordedC: "3.5",
  temperatureMinTempC: "0.0",
  temperatureMaxTempC: "5.0",
  temperatureResult: "ok",
  correctiveAction: null,
};

describe("toRecordItem stored occurrence values", () => {
  it("returns the stored occurrence fields with numerics as numbers", () => {
    const item = toRecordItem(row());

    expect(item).toMatchObject({
      occurrenceId: OCCURRENCE_ID,
      taskTemplateId: TEMPLATE_ID,
      occurrenceDate: "2026-08-23",
      scheduledTime: "08:00",
      dueAt: DUE_AT.toISOString(),
      title: "Morning fridge check",
      type: "temperature",
      equipmentId: EQUIPMENT_ID,
      equipmentName: "Fridge 1",
      minTempC: 0,
      maxTempC: 5,
    });
  });

  it("keeps a non-temperature occurrence's empty equipment and range null", () => {
    const item = toRecordItem(
      row({
        type: "cleaning",
        equipmentId: null,
        equipmentName: null,
        minTempC: null,
        maxTempC: null,
      }),
    );

    expect(item.equipmentName).toBeNull();
    expect(item.minTempC).toBeNull();
    expect(item.maxTempC).toBeNull();
  });

  it("produces a row the shared contract accepts", () => {
    expect(
      recordItemSchema.safeParse(
        toRecordItem(row({ ...submittedRecord, ...temperatureDetail })),
      ).success,
    ).toBe(true);
  });
});

describe("toRecordItem state derivation", () => {
  it("maps an unrecorded occurrence to missed / none / not_submitted", () => {
    expect(toRecordItem(row())).toMatchObject({
      displayState: "missed",
      recordState: "none",
      timing: "not_submitted",
      result: "not_evaluated",
      record: null,
    });
  });

  it("maps an active record to submitted, on time when recorded before due", () => {
    expect(toRecordItem(row(submittedRecord))).toMatchObject({
      displayState: "submitted",
      recordState: "submitted",
      timing: "on_time",
    });
  });

  it("marks a submission after the due instant as late", () => {
    expect(
      toRecordItem(
        row({
          ...submittedRecord,
          recordedAt: new Date(DUE_AT.getTime() + 60_000),
        }),
      ).timing,
    ).toBe("late");
  });

  it("maps a voided record to voided with no timing claim", () => {
    expect(
      toRecordItem(
        row({
          ...submittedRecord,
          voidedAt: new Date("2026-08-23T06:00:00.000Z"),
          voidedById: VOIDER_ID,
          voidedByFirstName: "Ada",
          voidedByLastName: "Admin",
        }),
      ),
    ).toMatchObject({
      displayState: "voided",
      recordState: "voided",
      timing: "not_submitted",
    });
  });

  it("reports the retained temperature result even on a voided record", () => {
    expect(
      toRecordItem(
        row({
          ...submittedRecord,
          ...temperatureDetail,
          temperatureResult: "out_of_range",
          voidedAt: new Date("2026-08-23T06:00:00.000Z"),
        }),
      ),
    ).toMatchObject({ displayState: "voided", result: "fail" });
  });

  it("maps ok and out_of_range onto pass and fail", () => {
    expect(
      toRecordItem(row({ ...submittedRecord, ...temperatureDetail })).result,
    ).toBe("pass");
    expect(
      toRecordItem(
        row({
          ...submittedRecord,
          ...temperatureDetail,
          temperatureResult: "out_of_range",
        }),
      ).result,
    ).toBe("fail");
  });
});

describe("toRecordItem record detail", () => {
  it("maps timestamps to ISO strings and numerics to numbers", () => {
    const item = toRecordItem(
      row({
        ...submittedRecord,
        ...temperatureDetail,
        correctiveAction: "Moved stock to the walk-in",
      }),
    );

    expect(item.record).toMatchObject({
      recordId: RECORD_ID,
      createdAt: "2026-08-23T04:40:00.000Z",
      recordedAt: "2026-08-23T04:50:00.000Z",
      voidedAt: null,
      temperature: {
        recordedC: 3.5,
        minTempC: 0,
        maxTempC: 5,
        result: "ok",
        correctiveAction: "Moved stock to the walk-in",
      },
    });
  });

  it("keeps the creator, current recorder and void actor apart", () => {
    const item = toRecordItem(
      row({
        ...submittedRecord,
        voidedAt: new Date("2026-08-23T06:00:00.000Z"),
        voidedById: VOIDER_ID,
        voidedByFirstName: "Vera",
        voidedByLastName: "Void",
      }),
    );

    expect(item.record?.createdBy).toEqual({
      id: CREATOR_ID,
      firstName: "Ada",
      lastName: "Admin",
    });
    expect(item.record?.recordedBy).toEqual({
      id: RECORDER_ID,
      firstName: "Emil",
      lastName: "Employee",
    });
    expect(item.record?.voidedBy).toEqual({
      id: VOIDER_ID,
      firstName: "Vera",
      lastName: "Void",
    });
  });

  it("leaves the void actor null while the record is active", () => {
    expect(toRecordItem(row(submittedRecord)).record?.voidedBy).toBeNull();
  });

  it("returns a null temperature detail for a non-temperature record", () => {
    expect(
      toRecordItem(row({ ...submittedRecord, type: "cleaning" })).record
        ?.temperature,
    ).toBeNull();
  });

  it("exposes no field M0 does not store", () => {
    const detail = toRecordItem(row(submittedRecord)).record!;

    expect(Object.keys(detail).sort()).toEqual([
      "createdAt",
      "createdBy",
      "recordId",
      "recordedAt",
      "recordedBy",
      "temperature",
      "voidedAt",
      "voidedBy",
    ]);
  });
});
