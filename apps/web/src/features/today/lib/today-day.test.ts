import type {
  FormVersionSummary,
  TodayResponse,
  TodayTaskItem,
} from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  buildTodayDay,
  checkShape,
  findGroup,
  groupChecksByArea,
} from "./today-day";

/** Europe/Sofia on a fixed winter date so the offset is a flat UTC+2. */
const SOFIA = "Europe/Sofia";
const DATE = "2026-01-15";
const FORM_VERSION = "00000000-0000-4000-8000-0000000000c1";
const TEMPLATE = "00000000-0000-4000-8000-0000000000a1";
const OTHER_TEMPLATE = "00000000-0000-4000-8000-0000000000a2";

function instant(date: string, localTime: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [h, m] = localTime.split(":").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, h! - 2, m)).toISOString();
}

function at(localTime: string, date = DATE): Date {
  return new Date(instant(date, localTime));
}

let seq = 0;
function uuid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

/** No window by default: open from the start of the day and never overdue. */
function task(overrides: Partial<TodayTaskItem> = {}): TodayTaskItem {
  const date = overrides.date ?? DATE;

  return {
    kind: "scheduled",
    occurrenceId: uuid(),
    recordId: null,
    templateId: TEMPLATE,
    title: "Fridge temperatures",
    formVersionId: FORM_VERSION,
    targetId: null,
    targetName: null,
    targetKind: null,
    area: null,
    resolvedLimits: {},
    scheduledTime: "08:00",
    timeSlot: "morning",
    date,
    availableAt: instant(date, "00:00"),
    dueAt: null,
    recordState: "none",
    status: "pending",
    completedAt: null,
    completedBy: null,
    result: null,
    values: null,
    correctiveAction: null,
    ...overrides,
  };
}

function done(overrides: Partial<TodayTaskItem> = {}): TodayTaskItem {
  return task({
    recordId: uuid(),
    recordState: "active",
    status: "completed",
    completedAt: instant(DATE, "08:05"),
    completedBy: { id: uuid(), firstName: "Maria", lastName: "Ivanova" },
    result: "pass",
    values: {},
    ...overrides,
  });
}

function form(fields: FormVersionSummary["definition"]["fields"]) {
  return {
    id: FORM_VERSION,
    formId: uuid(),
    formName: "Form",
    category: "temperature",
    appliesTo: "per_item",
    onDemand: false,
    version: 1,
    publishedAt: "2026-01-01T00:00:00.000Z",
    definition: { fields, correctiveAction: "required_on_fail" },
  } satisfies FormVersionSummary;
}

function response(
  tasks: TodayTaskItem[],
  overrides: Partial<TodayResponse> = {},
): TodayResponse {
  return {
    date: DATE,
    locationId: uuid(),
    currentUserId: uuid(),
    formVersions: {},
    sections: { morning: tasks, afternoon: [], evening: [] },
    onDemand: { forms: [], items: [], entries: [] },
    ...overrides,
  };
}

describe("buildTodayDay", () => {
  it("folds every item of one task at one time into a single row", () => {
    const day = buildTodayDay(
      response([
        task({ targetName: "Fridge 1" }),
        task({ targetName: "Fridge 2" }),
        task({ scheduledTime: "16:00", targetName: "Fridge 1" }),
        task({ templateId: OTHER_TEMPLATE, title: "Cleaning" }),
      ]),
      at("09:00"),
      SOFIA,
    );

    expect(day.total).toBe(3);
    expect(day.todo.map((group) => [group.title, group.checks.length])).toEqual(
      [
        ["Cleaning", 1],
        ["Fridge temperatures", 2],
      ],
    );
    expect(day.later.map((group) => group.scheduledTime)).toEqual(["16:00"]);
  });

  it("keeps a check timed after now in Later but leaves it open to fill", () => {
    const day = buildTodayDay(
      response([task({ scheduledTime: "16:00" })]),
      at("09:00"),
      SOFIA,
    );

    expect(day.later).toHaveLength(1);
    expect(day.later[0]?.isLocked).toBe(false);
    expect(day.later[0]?.window).toBeNull();
  });

  it("locks a check whose window has not opened yet", () => {
    const day = buildTodayDay(
      response([
        task({
          scheduledTime: "16:00",
          availableAt: instant(DATE, "15:30"),
          dueAt: instant(DATE, "16:30"),
        }),
      ]),
      at("09:00"),
      SOFIA,
    );

    expect(day.later[0]?.isLocked).toBe(true);
    expect(day.later[0]?.window).toEqual({ opensAt: "15:30", dueAt: "16:30" });
  });

  it("puts a check past its window first in To do, flagged late", () => {
    const day = buildTodayDay(
      response([
        task({ templateId: OTHER_TEMPLATE, title: "Cleaning" }),
        task({
          scheduledTime: "08:30",
          availableAt: instant(DATE, "08:00"),
          dueAt: instant(DATE, "08:45"),
        }),
      ]),
      at("09:00"),
      SOFIA,
    );

    expect(day.todo.map((group) => [group.title, group.isLate])).toEqual([
      ["Fridge temperatures", true],
      ["Cleaning", false],
    ]);
  });

  it("never marks a check without a window late, even on a past day", () => {
    const day = buildTodayDay(
      response([task()]),
      at("09:00", "2026-01-16"),
      SOFIA,
    );

    expect(day.isToday).toBe(false);
    expect(day.todo).toHaveLength(1);
    expect(day.todo[0]?.isLate).toBe(false);
    expect(day.later).toHaveLength(0);
  });

  it("locks everything on a future day", () => {
    const day = buildTodayDay(
      response(
        [
          task({
            date: "2026-01-16",
            availableAt: instant("2026-01-16", "00:00"),
          }),
        ],
        {
          date: "2026-01-16",
        },
      ),
      at("09:00"),
      SOFIA,
    );

    expect(day.isFuture).toBe(true);
    expect(day.later[0]?.isLocked).toBe(true);
  });

  it("is done only when every item is recorded, and counts deviations", () => {
    const partial = buildTodayDay(
      response([done(), task()]),
      at("09:00"),
      SOFIA,
    );
    expect(partial.todo[0]?.doneCount).toBe(1);
    expect(partial.doneCount).toBe(0);

    const complete = buildTodayDay(
      response([done(), done({ result: "fail" })]),
      at("09:00"),
      SOFIA,
    );
    expect(complete.done).toHaveLength(1);
    expect(complete.doneCount).toBe(1);
    expect(complete.deviationCount).toBe(1);
    expect(complete.done[0]?.completedBy?.firstName).toBe("Maria");
  });

  it("treats a voided record as not done", () => {
    const day = buildTodayDay(
      response([task({ recordId: uuid(), recordState: "voided" })]),
      at("09:00"),
      SOFIA,
    );

    expect(day.todo).toHaveLength(1);
    expect(day.done).toHaveLength(0);
  });

  it("lists on-demand entries apart from the scheduled total", () => {
    const entry = done({ kind: "on_demand", occurrenceId: null });
    const day = buildTodayDay(
      response([], { onDemand: { forms: [], items: [], entries: [entry] } }),
      at("09:00"),
      SOFIA,
    );

    expect(day.total).toBe(0);
    expect(day.entries.map((item) => item.key)).toEqual([entry.recordId]);
  });

  it("finds a row in any section", () => {
    const day = buildTodayDay(
      response([done(), task({ scheduledTime: "16:00" })]),
      at("09:00"),
      SOFIA,
    );

    expect(findGroup(day, day.later[0]!.key)).toBe(day.later[0]);
    expect(findGroup(day, "missing")).toBeNull();
  });
});

describe("checkShape", () => {
  function shapeOf(
    fields: FormVersionSummary["definition"]["fields"],
    count: number,
  ) {
    const day = buildTodayDay(
      response(
        Array.from({ length: count }, () => task()),
        { formVersions: { [FORM_VERSION]: form(fields) } },
      ),
      at("09:00"),
      SOFIA,
    );
    return checkShape(day.todo[0]!);
  }

  const tick = {
    id: "clean",
    label: "Clean",
    required: true,
    type: "checkbox",
  } as const;
  const temperature = {
    id: "temp",
    label: "Temperature",
    required: true,
    type: "measurement",
    parameter: "temperature",
    unit: "celsius",
    limits: { min: 0, max: 4 },
  } as const;

  it("answers a form with one control on the rows, whatever the control", () => {
    expect(shapeOf([tick], 3)).toBe("inline");
    expect(shapeOf([tick], 1)).toBe("inline");
    expect(shapeOf([temperature], 3)).toBe("inline");
  });

  it("opens a form per item when there are several controls and items", () => {
    expect(shapeOf([temperature, tick], 3)).toBe("items");
  });

  it("opens one form for a single check", () => {
    expect(shapeOf([temperature, tick], 1)).toBe("single");
  });
});

describe("groupChecksByArea", () => {
  const labels = { wholeRoom: "Whole room", fallback: "Check" };
  const changing = { id: uuid(), name: "Changing room" };
  const toilet = { id: uuid(), name: "Toilet" };

  function rowsFor(tasks: TodayTaskItem[]) {
    const day = buildTodayDay(response(tasks), at("09:00"), SOFIA);
    return groupChecksByArea(day.todo[0]!.checks, labels).map((group) => ({
      heading: group.heading,
      labels: group.rows.map((row) => row.label),
    }));
  }

  it("heads a room's checks with its name and drops the repeated prefix", () => {
    expect(
      rowsFor([
        task({ area: changing, targetName: "Changing room › Floor" }),
        task({ area: changing, targetName: "Changing room › Walls" }),
        task({
          area: changing,
          targetId: changing.id,
          targetName: "Changing room",
        }),
      ]),
    ).toEqual([
      { heading: "Changing room", labels: ["Floor", "Walls", "Whole room"] },
    ]);
  });

  it("skips the heading when a room has a single check", () => {
    expect(
      rowsFor([
        task({ area: changing, targetName: "Changing room › Floor" }),
        task({ area: toilet, targetId: toilet.id, targetName: "Toilet" }),
        task({ area: changing, targetName: "Changing room › Walls" }),
      ]),
    ).toEqual([
      { heading: "Changing room", labels: ["Floor", "Walls"] },
      { heading: null, labels: ["Toilet"] },
    ]);
  });

  it("lists standalone items without a heading", () => {
    expect(
      rowsFor([task({ targetName: "Freezer" }), task({ targetName: null })]),
    ).toEqual([{ heading: null, labels: ["Freezer", "Check"] }]);
  });
});
