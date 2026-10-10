import type { FormVersionSummaryMap, RecordItem, RecordValues } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { buildAnswerFormatters } from "@/features/forms/lib/answer-format";
import {
  groupReportRowsByDate,
  toReportRow,
  toReportRows,
  type ReportRowContext,
} from "./report-rows";

const FRIDGE_VERSION = "55555555-5555-4555-8555-555555555555";

const FORM_VERSIONS: FormVersionSummaryMap = {
  [FRIDGE_VERSION]: {
    id: FRIDGE_VERSION,
    formId: "66666666-6666-4666-8666-666666666666",
    formName: "Хладилник",
    category: "temperature",
    version: 1,
    definition: {
      correctiveAction: "required_on_fail",
      fields: [
        {
          id: "temperature",
          type: "measurement",
          label: "Температура",
          required: true,
          unit: "celsius",
          limits: { min: 0, max: 5 },
        },
      ],
    },
  },
};

const CONTEXT: ReportRowContext = {
  formVersions: FORM_VERSIONS,
  format: buildAnswerFormatters({
    locale: "bg",
    symbol: (unit) => (unit === "celsius" ? "°C" : unit),
    yes: "Да",
    no: "Не",
  }),
};

function reading(value: number, fails: boolean): RecordValues {
  return {
    temperature: {
      type: "measurement",
      value,
      unit: "celsius",
      min: 0,
      max: 5,
      fails,
    },
  };
}

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
    formVersionId: FRIDGE_VERSION,
    category: "temperature",
    targetId: "33333333-3333-4333-8333-333333333333",
    targetName: "Хладилник 1",
    resolvedLimits: { temperature: { min: 0, max: 5 } },
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
    values: {},
    correctiveAction: null,
    ...overrides,
  } as RecordItem["record"];
}

describe("toReportRow status", () => {
  it("prints a passing submission as done and on time", () => {
    const row = toReportRow(item({ record: record() }), CONTEXT);

    expect(row.status).toBe("done");
    expect(row.late).toBe(false);
  });

  it("prints a failed submission as failed", () => {
    const row = toReportRow(item({ result: "fail", record: record() }), CONTEXT);

    expect(row.status).toBe("fail");
  });

  it("keeps lateness alongside a failed result", () => {
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

  it("prints a voided row as voided even when its answers failed", () => {
    const row = toReportRow(
      item({
        displayState: "voided",
        recordState: "voided",
        timing: "not_submitted",
        result: "fail",
        record: record({
          voidedAt: "2026-08-23T06:10:00.000Z",
          voidedBy: ADA,
          values: reading(8.4, true),
          correctiveAction: "Преместени продукти",
        }),
      }),
      CONTEXT,
    );

    expect(row.status).toBe("voided");
    expect(row.answers).toBe("8,4 °C");
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
        "targetName",
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

  it("omits the target on a row that has none", () => {
    const row = toReportRow(
      item({
        category: "cleaning",
        targetId: null,
        targetName: null,
        resolvedLimits: {},
        result: "not_evaluated",
        record: record(),
      }),
      CONTEXT,
    );

    expect(row.status).toBe("done");
    expect("answers" in row).toBe(false);
    expect("targetName" in row).toBe(false);
  });

  it("labels each answer when the form asks several questions", () => {
    const row = toReportRow(
      item({
        formVersionId: "77777777-7777-4777-8777-777777777777",
        record: record({
          values: {
            ...reading(3, false),
            door: { type: "checkbox", value: true },
          },
        }),
      }),
      CONTEXT,
    );

    // Without the version in the map, ids stand in for the labels.
    expect(row.answers).toBe("temperature: 3 °C · door: Да");
  });

  it("keeps a corrective action off a row that has none", () => {
    const row = toReportRow(
      item({
        record: record({ values: reading(3.5, false) }),
      }),
      CONTEXT,
    );

    expect(row.answers).toBe("3,5 °C");
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
