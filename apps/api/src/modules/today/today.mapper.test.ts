import { describe, expect, it } from "vitest";
import { todayRepository } from "./today.repository.js";
import { buildCompletionKey, sortItemsByScheduledTime } from "./today.mapper.js";
import type { TodayTaskItem } from "@haccp/shared";

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
  const item = (scheduledTime: string): TodayTaskItem =>
    ({ scheduledTime }) as TodayTaskItem;

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

  it("does not mutate the input", () => {
    const input = [item("12:00"), item("07:00")];
    sortItemsByScheduledTime(input);

    expect(input.map((i) => i.scheduledTime)).toEqual(["12:00", "07:00"]);
  });
});
