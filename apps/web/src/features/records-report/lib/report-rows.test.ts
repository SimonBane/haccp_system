import type { RecordItem } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  groupReportRowsByDate,
  toReportRow,
  toReportRows,
} from "./report-rows";

const CONTEXT = { locale: "bg" };

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

describe("toReportRow status", () => {
  it("prints a passing submission as done and on time", () => {
    const row = toReportRow(item({ record: record() }), CONTEXT);

    expect(row.status).toBe("done");
    expect(row.late).toBe(false);
  });

  it("prints a failed temperature submission as out of range", () => {
    const row = toReportRow(item({ result: "fail", record: record() }), CONTEXT);

    expect(row.status).toBe("fail");
  });

  it("keeps lateness alongside an out-of-range result", () => {
    const row = toReportRow(
      item({ result: "fail", timing: "late", record: record() }),
      CONTEXT,
    );

    expect(row.status).toBe("fail");
    expect(row.late).toBe(true);
  });

  it("never marks a submitted no-deadline record late", () => {
    const row = toReportRow(
      item({ dueAt: null, timing: "no_deadline", record: record() }),
      CONTEXT,
    );

    expect(row.late).toBe(false);
  });

  it("prints an open row as open, with no lateness or recorder", () => {
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

    expect(row.status).toBe("open");
    expect(row.late).toBe(false);
    expect("recordedBy" in row).toBe(false);
  });

  it("prints a missed row as missed", () => {
    const row = toReportRow(
      item({
        displayState: "missed",
        recordState: "none",
        timing: "not_submitted",
      }),
      CONTEXT,
    );

    expect(row.status).toBe("missed");
    expect(row.late).toBe(false);
  });

  it("prints a voided row as voided even when its reading failed", () => {
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

    expect(row.status).toBe("voided");
    expect(row.reading).toBe("8,4 °C");
    expect(row.correctiveAction).toBe("Преместени продукти");
  });
});

describe("toReportRow minimal facts", () => {
  it("names the current recorder, not the first creator", () => {
    expect(toReportRow(item({ record: record() }), CONTEXT).recordedBy).toBe(
      "Борис Оператор",
    );
  });

  it("keeps a missing recorder distinguishable from no record at all", () => {
    const row = toReportRow(
      item({ record: record({ recordedBy: null }) }),
      CONTEXT,
    );

    expect(row.recordedBy).toBeNull();
  });

  it("carries no scheduling window, range or audit trail", () => {
    const row = toReportRow(item({ record: record() }), CONTEXT);

    expect(Object.keys(row).sort()).toEqual(
      [
        "equipmentName",
        "late",
        "occurrenceId",
        "recordedBy",
        "scheduledDate",
        "scheduledTime",
        "status",
        "title",
      ].sort(),
    );
  });

  it("omits reading and equipment on a cleaning row", () => {
    const row = toReportRow(
      item({
        type: "cleaning",
        equipmentId: null,
        equipmentName: null,
        minTempC: null,
        maxTempC: null,
        result: "not_evaluated",
        record: record(),
      }),
      CONTEXT,
    );

    expect(row.status).toBe("done");
    expect("reading" in row).toBe(false);
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

    expect(row.reading).toBe("3,5 °C");
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

describe("groupReportRowsByDate", () => {
  it("groups consecutive rows under their date without re-sorting", () => {
    const rows = toReportRows(
      [
        item({ occurrenceId: "1", occurrenceDate: "2026-08-23" }),
        item({ occurrenceId: "2", occurrenceDate: "2026-08-23" }),
        item({ occurrenceId: "3", occurrenceDate: "2026-08-24" }),
      ],
      CONTEXT,
    );

    expect(
      groupReportRowsByDate(rows).map((group) => ({
        date: group.date,
        ids: group.rows.map((row) => row.occurrenceId),
      })),
    ).toEqual([
      { date: "23.08.2026", ids: ["1", "2"] },
      { date: "24.08.2026", ids: ["3"] },
    ]);
  });

  it("returns no groups for no rows", () => {
    expect(groupReportRowsByDate([])).toEqual([]);
  });
});
