import type { TodayTaskItem } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  applyClock,
  buildTodayTaskGroups,
  buildTodayTimeline,
  isFutureSelection,
  isStaleResponse,
  timeGroupId,
} from "./today-timeline";

/** Europe/Sofia on a fixed winter date so the offset is a flat UTC+2. */
const SOFIA = "Europe/Sofia";
const DATE = "2026-01-15";

function at(localTime: string): Date {
  const [h, m] = localTime.split(":").map(Number);
  return new Date(Date.UTC(2026, 0, 15, h - 2, m));
}

/** `localTime` on `date` (Sofia, flat UTC+2 in winter), offset by `offsetMinutes`. */
function instantAt(
  date: string,
  localTime: string,
  offsetMinutes = 0,
): string {
  const [year, month, day] = date.split("-").map(Number);
  const [h, m] = localTime.split(":").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day, h - 2, m) + offsetMinutes * 60_000,
  ).toISOString();
}

let seq = 0;
function uuid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

/**
 * Default window: opens 30 minutes before its scheduled time, overdue 30 minutes after —
 * chosen only to make these fixtures exercise upcoming/now/overdue transitions; the actual
 * default template window (a full day) is covered in the shared/API tests.
 */
function task(overrides: Partial<TodayTaskItem> = {}): TodayTaskItem {
  const date = overrides.date ?? DATE;
  const scheduledTime = overrides.scheduledTime ?? "07:00";

  return {
    occurrenceId: uuid(),
    templateId: uuid(),
    title: "Task",
    type: "cleaning",
    equipmentId: null,
    equipmentName: null,
    minTempC: null,
    maxTempC: null,
    scheduledTime,
    timeSlot: "morning",
    date,
    availableAt: instantAt(date, scheduledTime, -30),
    dueAt: instantAt(date, scheduledTime, 30),
    recordState: "none",
    status: "pending",
    completedAt: null,
    completedBy: null,
    temperatureReading: null,
    ...overrides,
  };
}

const FRIDGE = uuid();

function buildTasks(): TodayTaskItem[] {
  seq = 100;
  return [
    task({
      scheduledTime: "12:00",
      timeSlot: "afternoon",
      title: "Fridge midday",
      type: "temperature",
      equipmentId: FRIDGE,
      equipmentName: "Fridge 1",
      minTempC: 0,
      maxTempC: 5,
      recordState: "active",
      status: "completed",
      completedAt: "2026-01-15T10:05:00.000Z",
      temperatureReading: {
        recordedC: 9.4,
        result: "out_of_range",
        minTempC: 0,
        maxTempC: 5,
        correctiveAction: "Moved stock",
      },
    }),
    task({ scheduledTime: "18:00", timeSlot: "evening", title: "Evening mop" }),
    task({
      scheduledTime: "07:00",
      title: "Fridge open",
      type: "temperature",
      equipmentId: FRIDGE,
      equipmentName: "Fridge 1",
      minTempC: 0,
      maxTempC: 5,
      recordState: "active",
      status: "completed",
      completedAt: "2026-01-15T05:04:00.000Z",
      temperatureReading: {
        recordedC: 3.1,
        result: "ok",
        minTempC: 0,
        maxTempC: 5,
        correctiveAction: null,
      },
    }),
    task({ scheduledTime: "18:00", timeSlot: "evening", title: "Evening bins" }),
    task({
      scheduledTime: "07:00",
      title: "Morning surfaces",
      recordState: "active",
      status: "completed",
      completedAt: "2026-01-15T05:20:00.000Z",
    }),
    task({
      scheduledTime: "18:00",
      timeSlot: "evening",
      title: "Fridge close",
      type: "temperature",
      equipmentId: FRIDGE,
      equipmentName: "Fridge 1",
      minTempC: 0,
      maxTempC: 5,
    }),
    task({ scheduledTime: "07:00", title: "Morning floor" }),
    task({
      scheduledTime: "12:00",
      timeSlot: "afternoon",
      title: "Midday wipe",
    }),
  ];
}

describe("buildTodayTimeline", () => {
  const tasks = buildTasks();

  it("groups by scheduled time in chronological order", () => {
    const timeline = buildTodayTimeline(tasks, at("09:00"), DATE, SOFIA);

    expect(timeline.groups.map((g) => g.scheduledTime)).toEqual([
      "07:00",
      "12:00",
      "18:00",
    ]);
    expect(timeline.groups.map((g) => g.total)).toEqual([3, 2, 3]);
    expect(timeline.groups[0].id).toBe(timeGroupId("07:00"));
  });

  it("counts completions, deviations and remainders per group", () => {
    const timeline = buildTodayTimeline(tasks, at("09:00"), DATE, SOFIA);

    expect(
      timeline.groups.map((g) => ({
        completed: g.completedCount,
        remaining: g.remainingCount,
        deviations: g.deviationCount,
      })),
    ).toEqual([
      { completed: 2, remaining: 1, deviations: 0 },
      { completed: 1, remaining: 1, deviations: 1 },
      { completed: 0, remaining: 3, deviations: 0 },
    ]);

    expect(timeline.total).toBe(8);
    expect(timeline.completedCount).toBe(3);
    expect(timeline.remainingCount).toBe(5);
    expect(timeline.deviationCount).toBe(1);
    expect(timeline.firstDeviationGroupId).toBe(timeGroupId("12:00"));
    expect(timeline.isAllDone).toBe(false);
  });

  it("carries the prior reading for the same equipment forward", () => {
    const timeline = buildTodayTimeline(tasks, at("09:00"), DATE, SOFIA);

    const [morning, midday, evening] = timeline.groups;
    const morningFridge = morning.items.find((i) => i.task.equipmentId);
    const middayFridge = midday.items.find((i) => i.task.equipmentId);
    const eveningFridge = evening.items.find((i) => i.task.equipmentId);

    expect(morningFridge?.priorReading).toBeNull();
    expect(middayFridge?.priorReading).toEqual({
      scheduledTime: "07:00",
      completedAt: "2026-01-15T05:04:00.000Z",
      recordedC: 3.1,
    });
    expect(eveningFridge?.priorReading).toEqual({
      scheduledTime: "12:00",
      completedAt: "2026-01-15T10:05:00.000Z",
      recordedC: 9.4,
    });
  });

  it("flags only completed out-of-range readings as deviations", () => {
    const timeline = buildTodayTimeline(tasks, at("09:00"), DATE, SOFIA);
    const flagged = timeline.groups
      .flatMap((g) => g.items)
      .filter((i) => i.isDeviation);

    expect(flagged).toHaveLength(1);
    expect(flagged[0].task.title).toBe("Fridge midday");
  });

  describe("clock-derived state", () => {
    it("before every round: 07:00 is upcoming and the now line is first", () => {
      const timeline = buildTodayTimeline(tasks, at("06:00"), DATE, SOFIA);

      expect(timeline.groups.map((g) => g.state)).toEqual([
        "upcoming",
        "upcoming",
        "upcoming",
      ]);
      expect(timeline.groups.map((g) => g.minutesUntil)).toEqual([60, 360, 720]);
      expect(timeline.overdueCount).toBe(0);
      expect(timeline.nowLineIndex).toBe(0);
      expect(timeline.nowMinutes).toBe(360);
      expect(timeline.focusGroupId).toBe(timeGroupId("07:00"));
      expect(timeline.firstOverdueGroupId).toBeNull();
    });

    it("mid-day with a live round: 12:00 is now, 07:00 is overdue", () => {
      // 12:10 sits inside the 30-minute due-now window after 12:00.
      const timeline = buildTodayTimeline(tasks, at("12:10"), DATE, SOFIA);

      expect(timeline.groups.map((g) => g.state)).toEqual([
        "overdue",
        "now",
        "upcoming",
      ]);
      expect(timeline.groups.map((g) => g.minutesUntil)).toEqual([
        -310, -10, 350,
      ]);
      expect(timeline.overdueCount).toBe(1);
      expect(timeline.nowLineIndex).toBe(2);
      expect(timeline.nowMinutes).toBe(730);
      expect(timeline.focusGroupId).toBe(timeGroupId("07:00"));
      expect(timeline.firstOverdueGroupId).toBe(timeGroupId("07:00"));
    });

    it("after every round: everything unfinished is overdue, line at the end", () => {
      const timeline = buildTodayTimeline(tasks, at("21:00"), DATE, SOFIA);

      expect(timeline.groups.map((g) => g.state)).toEqual([
        "overdue",
        "overdue",
        "overdue",
      ]);
      expect(timeline.overdueCount).toBe(5);
      expect(timeline.nowLineIndex).toBe(3);
      expect(timeline.nowMinutes).toBe(1260);
    });

    it("a past date's occurrences are overdue by their own window, not a blanket date rule", () => {
      const pastDate = "2026-01-14";
      const pastTasks = [
        task({ date: pastDate, scheduledTime: "07:00" }),
        task({ date: pastDate, scheduledTime: "12:00" }),
        task({ date: pastDate, scheduledTime: "18:00" }),
      ];
      const timeline = buildTodayTimeline(pastTasks, at("09:00"), pastDate, SOFIA);

      expect(timeline.groups.map((g) => g.state)).toEqual([
        "overdue",
        "overdue",
        "overdue",
      ]);
      expect(timeline.nowLineIndex).toBeNull();
      // minutesUntil is measured against the selected date, a day earlier.
      expect(timeline.groups[0].minutesUntil).toBe(-1560);
    });

    it("a future date's occurrences are upcoming because they have not opened, not because of the date", () => {
      const futureDate = "2026-01-16";
      const futureTasks = [
        task({ date: futureDate, scheduledTime: "07:00" }),
        task({ date: futureDate, scheduledTime: "12:00" }),
        task({ date: futureDate, scheduledTime: "18:00" }),
      ];
      const timeline = buildTodayTimeline(
        futureTasks,
        at("09:00"),
        futureDate,
        SOFIA,
      );

      expect(timeline.groups.map((g) => g.state)).toEqual([
        "upcoming",
        "upcoming",
        "upcoming",
      ]);
      expect(timeline.nowLineIndex).toBeNull();
    });

    it("mixed windows at one scheduled time: each row keeps its own status, and any overdue item wins the group", () => {
      const opened = task({
        scheduledTime: "08:00",
        title: "Opens early",
        availableAt: instantAt(DATE, "08:00", -120),
        dueAt: instantAt(DATE, "08:00", 60),
      });
      const notYetOpen = task({
        scheduledTime: "08:00",
        title: "Opens late",
        availableAt: instantAt(DATE, "08:00", 90),
        dueAt: instantAt(DATE, "08:00", 180),
      });

      // now = 08:00 + 45min: "opened" is pending (available); "notYetOpen" has not opened yet.
      const now = new Date(instantAt(DATE, "08:00", 45));
      const timeline = buildTodayTimeline([opened, notYetOpen], now, DATE, SOFIA);

      expect(timeline.groups).toHaveLength(1);
      const [group] = timeline.groups;
      const byTitle = Object.fromEntries(
        group.items.map((item) => [item.task.title, item.liveStatus]),
      );
      expect(byTitle["Opens early"]).toBe("pending");
      expect(byTitle["Opens late"]).toBe("upcoming");
      // At least one remaining item is available, so the group reads "now".
      expect(group.state).toBe("now");

      // "Opens early" is now overdue while "Opens late" still has not opened — overdue wins.
      const later = new Date(instantAt(DATE, "08:00", 61));
      const overdueTimeline = buildTodayTimeline(
        [opened, notYetOpen],
        later,
        DATE,
        SOFIA,
      );
      const laterByTitle = Object.fromEntries(
        overdueTimeline.groups[0].items.map((item) => [
          item.task.title,
          item.liveStatus,
        ]),
      );
      expect(laterByTitle["Opens early"]).toBe("overdue");
      expect(laterByTitle["Opens late"]).toBe("upcoming");
      expect(overdueTimeline.groups[0].state).toBe("overdue");
    });

    it("a never-overdue remaining item keeps its group at now, never overdue, on a past date", () => {
      const pastDate = "2026-01-14";
      const neverOverdue = task({
        date: pastDate,
        scheduledTime: "07:00",
        dueAt: null,
      });
      const timeline = buildTodayTimeline(
        [neverOverdue],
        at("09:00"),
        pastDate,
        SOFIA,
      );

      expect(timeline.groups[0].state).toBe("now");
      expect(timeline.overdueCount).toBe(0);
    });

    it("only the group whose range contains the clock reads now, even when a later group's window has already opened", () => {
      // A wide completion window (opens 5h early) lets 18:30's item become "available" well
      // before 14:00's own slot has passed — it must still read "upcoming", not "now".
      const current = task({
        scheduledTime: "14:00",
        availableAt: instantAt(DATE, "14:00", -30),
        dueAt: instantAt(DATE, "14:00", 30),
      });
      const opensEarly = task({
        scheduledTime: "18:30",
        availableAt: instantAt(DATE, "18:30", -300),
        dueAt: instantAt(DATE, "18:30", 30),
      });

      const timeline = buildTodayTimeline(
        [current, opensEarly],
        at("14:10"),
        DATE,
        SOFIA,
      );

      expect(timeline.groups.map((g) => g.scheduledTime)).toEqual([
        "14:00",
        "18:30",
      ]);
      expect(timeline.groups.map((g) => g.state)).toEqual(["now", "upcoming"]);
    });

    it("a still-pending earlier slot stays now once the clock moves into a later slot, until it's overdue", () => {
      // 14:00's window is long (closes at 16:00), so it's still open when the clock reaches
      // 14:53 — it already started, so it should read "now" alongside the current slot, not
      // "upcoming".
      const stillOpen = task({
        scheduledTime: "14:00",
        availableAt: instantAt(DATE, "14:00", -30),
        dueAt: instantAt(DATE, "14:00", 120),
      });
      const current = task({
        scheduledTime: "14:53",
        availableAt: instantAt(DATE, "14:53", -10),
        dueAt: instantAt(DATE, "14:53", 30),
      });

      const now = new Date(instantAt(DATE, "14:53"));
      const timeline = buildTodayTimeline([stillOpen, current], now, DATE, SOFIA);

      expect(timeline.groups.map((g) => g.scheduledTime)).toEqual([
        "14:00",
        "14:53",
      ]);
      expect(timeline.groups.map((g) => g.state)).toEqual(["now", "now"]);

      // Once 14:00's own window lapses, it becomes overdue rather than staying "now".
      const later = new Date(instantAt(DATE, "14:00", 121));
      const overdueTimeline = buildTodayTimeline(
        [stillOpen, current],
        later,
        DATE,
        SOFIA,
      );
      expect(overdueTimeline.groups[0].state).toBe("overdue");
    });

    it("a fully completed group reads done regardless of the clock", () => {
      const allDoneAt7 = tasks.map((t) =>
        t.scheduledTime === "07:00"
          ? {
              ...t,
              status: "completed" as const,
              completedAt: "2026-01-15T05:30:00.000Z",
            }
          : t,
      );
      const timeline = buildTodayTimeline(allDoneAt7, at("21:00"), DATE, SOFIA);

      expect(timeline.groups[0].state).toBe("done");
      expect(timeline.focusGroupId).toBe(timeGroupId("12:00"));
    });

    it("suppresses the now line once every task is done", () => {
      const allDone = tasks.map((t) => ({
        ...t,
        status: "completed" as const,
        completedAt: "2026-01-15T05:30:00.000Z",
      }));
      const timeline = buildTodayTimeline(allDone, at("09:00"), DATE, SOFIA);

      expect(timeline.isAllDone).toBe(true);
      expect(timeline.nowLineIndex).toBeNull();
      expect(timeline.focusGroupId).toBeNull();
    });
  });

  it("returns an empty timeline for no tasks", () => {
    const timeline = buildTodayTimeline([], at("09:00"), DATE, SOFIA);

    expect(timeline.groups).toEqual([]);
    expect(timeline.total).toBe(0);
    expect(timeline.isAllDone).toBe(false);
    expect(timeline.focusGroupId).toBeNull();
    // No group is ahead of the clock, so the marker goes after the (empty) list.
    expect(timeline.nowLineIndex).toBe(0);
  });

  it("does not mutate the input array", () => {
    const input = buildTasks();
    const order = input.map((t) => t.title);
    buildTodayTimeline(input, at("09:00"), DATE, SOFIA);

    expect(input.map((t) => t.title)).toEqual(order);
  });

describe("buildTodayTaskGroups + applyClock", () => {
    const tasks = buildTasks();

    it("is equivalent to buildTodayTimeline at every clock position", () => {
      const base = buildTodayTaskGroups(tasks);

      for (const [clock, date] of [
        ["06:00", DATE],
        ["12:10", DATE],
        ["21:00", DATE],
        ["09:00", "2026-01-14"],
        ["09:00", "2026-01-16"],
      ] as const) {
        expect(applyClock(base, at(clock), date, SOFIA)).toEqual(
          buildTodayTimeline(tasks, at(clock), date, SOFIA),
        );
      }
    });

    it("keeps an item's identity stable across ticks that stay inside its own window", () => {
      const pending = task({
        scheduledTime: "12:00",
        status: "pending",
        availableAt: instantAt(DATE, "12:00", -30),
        dueAt: instantAt(DATE, "12:00", 30),
      });
      const base = buildTodayTaskGroups([pending]);
      const a = applyClock(base, at("12:05"), DATE, SOFIA);
      const b = applyClock(base, at("12:06"), DATE, SOFIA);

      expect(a.groups[0].state).toBe("now");
      expect(a.groups[0].items[0]).toBe(b.groups[0].items[0]);
    });

    it("allocates a fresh item once its liveStatus crosses out of the seeded value, leaving completed items untouched", () => {
      const base = buildTodayTaskGroups(tasks);
      // "Midday wipe" (group 1, seeded pending) is still pending at 12:05 and overdue by 21:00.
      const before = applyClock(base, at("12:05"), DATE, SOFIA);
      const after = applyClock(base, at("21:00"), DATE, SOFIA);

      expect(before.groups[1].state).toBe("now");
      expect(after.groups[1].state).toBe("overdue");

      const completedIndex = before.groups[0].items.findIndex(
        (item) => item.isCompleted,
      );
      expect(completedIndex).toBeGreaterThanOrEqual(0);
      expect(before.groups[0].items[completedIndex]).toBe(
        after.groups[0].items[completedIndex],
      );
    });

    it("still produces a fresh timeline when the tasks change", () => {
      const a = applyClock(buildTodayTaskGroups(tasks), at("09:00"), DATE, SOFIA);
      const b = applyClock(
        buildTodayTaskGroups(buildTasks()),
        at("09:00"),
        DATE,
        SOFIA,
      );

      expect(a.groups[0].items[0]).not.toBe(b.groups[0].items[0]);
    });

    it("recomputes clock-derived state while reusing completed items across the tick", () => {
      const base = buildTodayTaskGroups(tasks);
      const morning = applyClock(base, at("06:00"), DATE, SOFIA);
      const evening = applyClock(base, at("21:00"), DATE, SOFIA);

      expect(morning.groups[0].state).toBe("upcoming");
      expect(evening.groups[0].state).toBe("overdue");

      // The two completed items in the 07:00 group never depend on the clock.
      const completedIndexes = morning.groups[0].items
        .map((item, index) => (item.isCompleted ? index : -1))
        .filter((index) => index !== -1);
      expect(completedIndexes).toHaveLength(2);
      for (const index of completedIndexes) {
        expect(morning.groups[0].items[index]).toBe(evening.groups[0].items[index]);
      }
    });
  });
});

describe("isFutureSelection", () => {
  it("is false for the organization's current business date", () => {
    expect(isFutureSelection(DATE, at("12:00"), SOFIA)).toBe(false);
  });

  it("is false for a past date", () => {
    expect(isFutureSelection("2026-01-14", at("12:00"), SOFIA)).toBe(false);
  });

  it("is true for a date after the organization's current business date", () => {
    expect(isFutureSelection("2026-01-16", at("12:00"), SOFIA)).toBe(true);
  });
});

describe("isStaleResponse", () => {
  it("is false when the response date matches the selection", () => {
    expect(isStaleResponse(DATE, DATE)).toBe(false);
  });

  it("is true when the response still reflects a previous date", () => {
    expect(isStaleResponse("2026-01-14", DATE)).toBe(true);
  });

  it("is true while there is no response yet", () => {
    expect(isStaleResponse(undefined, DATE)).toBe(true);
  });
});
