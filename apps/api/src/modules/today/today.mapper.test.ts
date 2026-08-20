import { describe, expect, it } from "vitest";
import { todayRepository } from "./today.repository.js";
import type { OccurrenceWithRecordRow } from "./today.repository.js";
import {
  buildCompletionKey,
  sortItemsByScheduledTime,
  toTodayTaskItem,
} from "./today.mapper.js";
import type { TodayTaskItem } from "@haccp/shared";

const OCCURRENCE_A = "00000000-0000-4000-8000-00000000000a";
const OCCURRENCE_B = "00000000-0000-4000-8000-00000000000b";

/** Repository key format must match the mapper — drift silently shows completed tasks as pending. */
const TEMPLATE = "00000000-0000-4000-8000-00000000000t";
const USER = "00000000-0000-4000-8000-00000000000u";

type CompletionRow = Parameters<
  typeof todayRepository.buildCompletionMap
>[0][number];

function completionRow(overrides: Partial<CompletionRow> = {}): CompletionRow {
  return {
    taskTemplateId: TEMPLATE,
    scheduledTime: "07:00",
    completedAt: new Date("2026-01-15T05:04:00Z"),
    completedByUserId: USER,
    completedByFirstName: "Ann",
    completedByLastName: "Lee",
    recordedC: null,
    minTempC: null,
    maxTempC: null,
    result: null,
    correctiveAction: null,
    ...overrides,
  } as CompletionRow;
}

describe("buildCompletionKey", () => {
  it("joins template and scheduled time with a pipe", () => {
    expect(buildCompletionKey(TEMPLATE, "07:00")).toBe(`${TEMPLATE}|07:00`);
  });

  it("distinguishes two rounds of the same template", () => {
    expect(buildCompletionKey(TEMPLATE, "07:00")).not.toBe(
      buildCompletionKey(TEMPLATE, "12:00"),
    );
  });
});

describe("buildCompletionMap", () => {
  it("keys rows the same way buildCompletionKey does", () => {
    const map = todayRepository.buildCompletionMap([completionRow()]);

    expect([...map.keys()]).toEqual([buildCompletionKey(TEMPLATE, "07:00")]);
    expect(map.get(buildCompletionKey(TEMPLATE, "07:00"))).toBeDefined();
  });

  it("keeps separate rounds of one template apart", () => {
    const map = todayRepository.buildCompletionMap([
      completionRow({ scheduledTime: "07:00" }),
      completionRow({ scheduledTime: "12:00" }),
    ]);

    expect(map.size).toBe(2);
    expect(map.has(buildCompletionKey(TEMPLATE, "12:00"))).toBe(true);
  });

  it("projects the completing user onto a summary", () => {
    const map = todayRepository.buildCompletionMap([completionRow()]);

    expect(map.get(buildCompletionKey(TEMPLATE, "07:00"))?.completedBy).toEqual({
      id: USER,
      firstName: "Ann",
      lastName: "Lee",
    });
  });

  it("attaches a temperature log when every field is present", () => {
    const map = todayRepository.buildCompletionMap([
      completionRow({
        recordedC: "3.1",
        minTempC: "0.0",
        maxTempC: "5.0",
        result: "ok",
        correctiveAction: null,
      }),
    ]);

    expect(
      map.get(buildCompletionKey(TEMPLATE, "07:00"))?.temperatureLog,
    ).toEqual({
      recordedC: "3.1",
      minTempC: "0.0",
      maxTempC: "5.0",
      result: "ok",
      correctiveAction: null,
    });
  });

  it("omits the temperature log when the left join produced no row", () => {
    const map = todayRepository.buildCompletionMap([completionRow()]);

    expect(
      map.get(buildCompletionKey(TEMPLATE, "07:00"))?.temperatureLog,
    ).toBeNull();
  });

  it("omits a partially populated temperature log rather than half-reporting", () => {
    const map = todayRepository.buildCompletionMap([
      completionRow({ recordedC: "3.1", minTempC: null, maxTempC: "5.0", result: "ok" }),
    ]);

    expect(
      map.get(buildCompletionKey(TEMPLATE, "07:00"))?.temperatureLog,
    ).toBeNull();
  });

  it("returns an empty map for no rows", () => {
    expect(todayRepository.buildCompletionMap([]).size).toBe(0);
  });
});

describe("sortItemsByScheduledTime", () => {
  const item = (scheduledTime: string, occurrenceId = OCCURRENCE_A): TodayTaskItem =>
    ({ scheduledTime, occurrenceId }) as TodayTaskItem;

  it("orders by clock time, not string order", () => {
    // Lexical "09:00" > "12:00"; clock order must put 9am first.
    const sorted = sortItemsByScheduledTime([
      item("12:00"),
      item("09:00"),
      item("07:30"),
    ]);

    expect(sorted.map((i) => i.scheduledTime)).toEqual([
      "07:30",
      "09:00",
      "12:00",
    ]);
  });

  it("breaks a same-time tie by occurrenceId", () => {
    const sorted = sortItemsByScheduledTime([
      item("07:00", OCCURRENCE_B),
      item("07:00", OCCURRENCE_A),
    ]);

    expect(sorted.map((i) => i.occurrenceId)).toEqual([
      OCCURRENCE_A,
      OCCURRENCE_B,
    ]);
  });

  it("does not mutate the input", () => {
    const input = [item("12:00"), item("07:00")];
    sortItemsByScheduledTime(input);

    expect(input.map((i) => i.scheduledTime)).toEqual(["12:00", "07:00"]);
  });
});

describe("toTodayTaskItem", () => {
  const NOW = new Date("2026-01-15T08:00:00Z");

  function occurrenceRow(
    overrides: Partial<OccurrenceWithRecordRow> = {},
  ): OccurrenceWithRecordRow {
    return {
      occurrenceId: OCCURRENCE_A,
      taskTemplateId: "00000000-0000-4000-8000-00000000000t",
      title: "Check walk-in fridge",
      type: "temperature",
      equipmentId: "00000000-0000-4000-8000-00000000000e",
      equipmentName: "Walk-in fridge",
      minTempC: "0.0",
      maxTempC: "5.0",
      scheduledTime: "07:00",
      occurrenceDate: "2026-01-15",
      dueAt: new Date("2026-01-15T07:00:00Z"),
      recordedAt: null,
      recordedByUserId: null,
      recordedByFirstName: null,
      recordedByLastName: null,
      voidedAt: null,
      detailRecordedC: null,
      detailMinTempC: null,
      detailMaxTempC: null,
      detailResult: null,
      detailCorrectiveAction: null,
      ...overrides,
    };
  }

  it("maps an unrecorded occurrence to recordState none and status overdue past dueAt", () => {
    const item = toTodayTaskItem(occurrenceRow(), NOW);

    expect(item.occurrenceId).toBe(OCCURRENCE_A);
    expect(item.recordState).toBe("none");
    expect(item.status).toBe("overdue");
    expect(item.completedAt).toBeNull();
    expect(item.completedBy).toBeNull();
    expect(item.temperatureReading).toBeNull();
  });

  it("maps an active record to recordState active with its reading", () => {
    const row = occurrenceRow({
      recordedAt: new Date("2026-01-15T07:05:00Z"),
      recordedByUserId: "00000000-0000-4000-8000-00000000000u",
      recordedByFirstName: "Ann",
      recordedByLastName: "Lee",
      voidedAt: null,
      detailRecordedC: "3.1",
      detailMinTempC: "0.0",
      detailMaxTempC: "5.0",
      detailResult: "ok",
      detailCorrectiveAction: null,
    });

    const item = toTodayTaskItem(row, NOW);

    expect(item.recordState).toBe("active");
    expect(item.status).toBe("completed");
    expect(item.completedAt).toBe("2026-01-15T07:05:00.000Z");
    expect(item.completedBy).toEqual({
      id: "00000000-0000-4000-8000-00000000000u",
      firstName: "Ann",
      lastName: "Lee",
    });
    expect(item.temperatureReading).toEqual({
      recordedC: 3.1,
      minTempC: 0,
      maxTempC: 5,
      result: "ok",
      correctiveAction: null,
    });
  });

  it("renders a voided record as uncompleted and does not expose its old reading", () => {
    const row = occurrenceRow({
      recordedAt: new Date("2026-01-15T07:05:00Z"),
      recordedByUserId: "00000000-0000-4000-8000-00000000000u",
      recordedByFirstName: "Ann",
      recordedByLastName: "Lee",
      voidedAt: new Date("2026-01-15T07:10:00Z"),
      detailRecordedC: "3.1",
      detailMinTempC: "0.0",
      detailMaxTempC: "5.0",
      detailResult: "ok",
      detailCorrectiveAction: null,
    });

    const item = toTodayTaskItem(row, NOW);

    expect(item.recordState).toBe("voided");
    expect(item.completedAt).toBeNull();
    expect(item.completedBy).toBeNull();
    expect(item.temperatureReading).toBeNull();
  });
});
