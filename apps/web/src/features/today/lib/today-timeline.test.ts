import type { TodayTaskItem } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  applyClock,
  buildTodayTaskGroups,
  buildTodayTimeline,
  timeGroupId,
} from "./today-timeline";

/**
 * Characterization test for the Today timeline.
 *
 * `buildTodayTimeline` is the whole of the Today page's derived state, and it is
 * about to be split so the per-task item objects stop being reallocated on every
 * clock tick. These assertions pin the current output at four clock positions so
 * the split can be proved output-identical rather than eyeballed.
 *
 * Everything is in Europe/Sofia (the product default) on a fixed winter date, so
 * the offset is a flat UTC+2 and no DST behaviour leaks into the expectations.
 */
const SOFIA = "Europe/Sofia";
const DATE = "2026-01-15";

/** 2026-01-15T{hh:mm} local == UTC-2. */
function at(localTime: string): Date {
  const [h, m] = localTime.split(":").map(Number);
  return new Date(Date.UTC(2026, 0, 15, h - 2, m));
}

let seq = 0;
function uuid(): string {
  seq += 1;
  return `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
}

function task(overrides: Partial<TodayTaskItem> = {}): TodayTaskItem {
  return {
    templateId: uuid(),
    title: "Task",
    type: "cleaning",
    equipmentId: null,
    equipmentName: null,
    minTempC: null,
    maxTempC: null,
    scheduledTime: "07:00",
    timeSlot: "morning",
    date: DATE,
    status: "pending",
    completedAt: null,
    completedBy: null,
    temperatureReading: null,
    ...overrides,
  };
}

const FRIDGE = uuid();

/**
 * Eight occurrences over three rounds, deliberately supplied out of time order
 * so the sort is exercised:
 *   07:00 - fridge temp (done, in range), cleaning (done), cleaning (pending)
 *   12:00 - fridge temp (done, OUT OF RANGE), cleaning (pending)
 *   18:00 - fridge temp (pending), cleaning (pending), cleaning (pending)
 */
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

    // The first reading of the day has nothing before it.
    expect(morningFridge?.priorReading).toBeNull();
    // Midday sees the 07:00 reading; evening sees the 12:00 one.
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

    it("a past date has no now line and marks unfinished rounds overdue", () => {
      const timeline = buildTodayTimeline(
        tasks,
        at("09:00"),
        "2026-01-14",
        SOFIA,
      );

      expect(timeline.groups.map((g) => g.state)).toEqual([
        "overdue",
        "overdue",
        "overdue",
      ]);
      expect(timeline.nowLineIndex).toBeNull();
      // minutesUntil is measured against the selected date, a day earlier.
      expect(timeline.groups[0].minutesUntil).toBe(-1560);
    });

    it("a future date is entirely upcoming with no now line", () => {
      const timeline = buildTodayTimeline(
        tasks,
        at("09:00"),
        "2026-01-16",
        SOFIA,
      );

      expect(timeline.groups.map((g) => g.state)).toEqual([
        "upcoming",
        "upcoming",
        "upcoming",
      ]);
      expect(timeline.nowLineIndex).toBeNull();
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

    /**
     * The reason the split exists. `TodayTaskRow` is memoised on `item`, so an
     * identity change every minute made the memo permanently useless — ~40 rows
     * re-rendering on a wall-mounted tablet for no new information.
     */
    it("keeps item identity stable across clock ticks", () => {
      const base = buildTodayTaskGroups(tasks);
      const a = applyClock(base, at("09:00"), DATE, SOFIA);
      const b = applyClock(base, at("09:01"), DATE, SOFIA);

      expect(a.groups[0].items[0]).toBe(b.groups[0].items[0]);
      expect(a.groups[0].items).toBe(b.groups[0].items);
    });

    it("still produces a fresh timeline when the tasks change", () => {
      // Identity must track the data, so an optimistic patch still re-renders.
      const a = applyClock(buildTodayTaskGroups(tasks), at("09:00"), DATE, SOFIA);
      const b = applyClock(
        buildTodayTaskGroups(buildTasks()),
        at("09:00"),
        DATE,
        SOFIA,
      );

      expect(a.groups[0].items[0]).not.toBe(b.groups[0].items[0]);
    });

    it("recomputes clock-derived state while reusing the items", () => {
      const base = buildTodayTaskGroups(tasks);
      const morning = applyClock(base, at("06:00"), DATE, SOFIA);
      const evening = applyClock(base, at("21:00"), DATE, SOFIA);

      expect(morning.groups[0].state).toBe("upcoming");
      expect(evening.groups[0].state).toBe("overdue");
      expect(morning.groups[0].items).toBe(evening.groups[0].items);
    });
  });
});
