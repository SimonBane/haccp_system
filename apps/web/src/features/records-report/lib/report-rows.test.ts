import type { RecordItem } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { toReportRow, toReportRows } from "./report-rows";

const CONTEXT = { locale: "bg", timeZone: "Europe/Sofia" };

const OCCURRENCE_ID = "11111111-1111-4111-8111-111111111111";
const ADA = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  firstName: "Ада",
  lastName: "Админ",
};
const BORIS = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  firstName: "Борис",
  lastName: "Оператор",
};

function item(overrides: Partial<RecordItem> = {}): RecordItem {
  return {
    occurrenceId: OCCURRENCE_ID,
    taskTemplateId: "22222222-2222-4222-8222-222222222222",
    occurrenceDate: "2026-08-23",
    scheduledTime: "08:00",
    availableAt: "2026-08-23T00:00:00.000Z",
    dueAt: "2026-08-23T05:00:00.000Z",
    title: "Сутрешна проверка на хладилника",
    type: "temperature",
    equipmentId: "33333333-3333-4333-8333-333333333333",
    equipmentName: "Хладилник 1",
    minTempC: 0,
    maxTempC: 5,
    displayState: "submitted",
    recordState: "submitted",
    timing: "on_time",
    result: "pass",
    record: null,
    ...overrides,
  } as RecordItem;
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    recordId: "44444444-4444-4444-8444-444444444444",
    createdAt: "2026-08-23T04:40:00.000Z",
    createdBy: ADA,
    recordedAt: "2026-08-23T04:55:00.000Z",
    recordedBy: BORIS,
    voidedAt: null,
    voidedBy: null,
    temperature: null,
    ...overrides,
  } as RecordItem["record"];
}

describe("toReportRow deadline presentation", () => {
  it("prints a finite deadline", () => {
    expect(toReportRow(item(), CONTEXT).dueAt).toBe("23.08.2026, 08:00");
  });

  it("emits no deadline key at all when dueAt is null", () => {
    const row = toReportRow(item({ dueAt: null }), CONTEXT);

    expect("dueAt" in row).toBe(false);
    expect(JSON.stringify(row)).not.toContain("dueAt");
  });

  it("always prints available-from, which a no-deadline row still has", () => {
    expect(toReportRow(item({ dueAt: null }), CONTEXT).availableAt).toBe(
      "23.08.2026, 03:00",
    );
  });
});

describe("toReportRow state and timing", () => {
  it("renders an open row with no timing suffix", () => {
    const row = toReportRow(
      item({
        dueAt: null,
        displayState: "open",
        recordState: "none",
        timing: "not_submitted",
        result: "not_evaluated",
      }),
      CONTEXT,
    );

    expect(row.displayState).toBe("open");
    expect("timing" in row).toBe(false);
  });

  it("renders a submitted no-deadline record as on time", () => {
    const row = toReportRow(
      item({ dueAt: null, timing: "no_deadline", record: record() }),
      CONTEXT,
    );

    expect(row.timing).toBe("on_time");
  });

  it("keeps a late submission late", () => {
    const row = toReportRow(
      item({ timing: "late", record: record() }),
      CONTEXT,
    );

    expect(row.timing).toBe("late");
  });

  it("carries no timing claim on a missed row", () => {
    const row = toReportRow(
      item({
        displayState: "missed",
        recordState: "none",
        timing: "not_submitted",
      }),
      CONTEXT,
    );

    expect("timing" in row).toBe(false);
  });
});

describe("toReportRow attribution", () => {
  it("keeps the first creator and the current recorder distinct", () => {
    const row = toReportRow(item({ record: record() }), CONTEXT);

    expect(row.created).toEqual({ at: "23.08.2026, 07:40", by: "Ада Админ" });
    expect(row.recorded).toEqual({
      at: "23.08.2026, 07:55",
      by: "Борис Оператор",
    });
  });

  it("reports a missing user as unknown rather than an empty name", () => {
    const row = toReportRow(
      item({ record: record({ createdBy: null }) }),
      CONTEXT,
    );

    expect(row.created?.by).toBeNull();
  });

  it("adds voided attribution only on a voided row", () => {
    expect("voided" in toReportRow(item({ record: record() }), CONTEXT)).toBe(
      false,
    );

    const voided = toReportRow(
      item({
        displayState: "voided",
        recordState: "voided",
        timing: "not_submitted",
        record: record({ voidedAt: "2026-08-23T06:10:00.000Z", voidedBy: ADA }),
      }),
      CONTEXT,
    );

    expect(voided.voided).toEqual({ at: "23.08.2026, 09:10", by: "Ада Админ" });
  });

  it("keeps the retained temperature payload on a voided row", () => {
    const row = toReportRow(
      item({
        displayState: "voided",
        recordState: "voided",
        timing: "not_submitted",
        result: "fail",
        record: record({
          voidedAt: "2026-08-23T06:10:00.000Z",
          voidedBy: ADA,
          temperature: {
            recordedC: 8.4,
            minTempC: 0,
            maxTempC: 5,
            result: "out_of_range",
            correctiveAction: "Преместени продукти",
          },
        }),
      }),
      CONTEXT,
    );

    expect(row.reading).toBe("8,4 °C");
    expect(row.correctiveAction).toBe("Преместени продукти");
    expect(row.result).toBe("fail");
  });
});

describe("toReportRow temperature presentation", () => {
  it("prints the stored permitted range", () => {
    expect(toReportRow(item(), CONTEXT).permittedRange).toBe("0 °C – 5 °C");
  });

  it("omits reading, range and outcome on a cleaning row", () => {
    const row = toReportRow(
      item({
        type: "cleaning",
        equipmentId: null,
        equipmentName: null,
        minTempC: null,
        maxTempC: null,
        result: "not_evaluated",
      }),
      CONTEXT,
    );

    expect("reading" in row).toBe(false);
    expect("permittedRange" in row).toBe(false);
    expect("result" in row).toBe(false);
    expect("equipmentName" in row).toBe(false);
  });

  it("keeps a corrective action off a row that has none", () => {
    const row = toReportRow(
      item({
        record: record({
          temperature: {
            recordedC: 3.5,
            minTempC: 0,
            maxTempC: 5,
            result: "ok",
            correctiveAction: null,
          },
        }),
      }),
      CONTEXT,
    );

    expect("correctiveAction" in row).toBe(false);
  });
});

describe("toReportRows", () => {
  it("preserves the order the API returned", () => {
    const ids = ["a", "b", "c"].map(
      (letter) => `${letter.repeat(8)}-1111-4111-8111-111111111111`,
    );

    const rows = toReportRows(
      ids.map((occurrenceId) => item({ occurrenceId })),
      CONTEXT,
    );

    expect(rows.map((row) => row.occurrenceId)).toEqual(ids);
  });
});
