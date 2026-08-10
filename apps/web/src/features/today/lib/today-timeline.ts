import type { TodayTaskItem } from "@haccp/shared";
import {
  wallClockToInstant,
  zonedDateString,
  zonedMinutesOfDay,
} from "@haccp/shared";
import {
  isDueNow,
  minutesUntilScheduled,
  occurrenceKey,
  parseScheduledTimeToMinutes,
} from "./today-grouping";

/**
 * The Today page has a single axis: the clock.
 *
 * Tasks hang off their exact scheduled time, and a task never changes group when
 * it is completed — only its own state changes. That keeps the worker's spatial
 * memory of the list intact and removes the need for any layout animation.
 */
export type TimeGroupState = "done" | "overdue" | "now" | "upcoming";

/**
 * `completedAt` is when the reading was actually taken; `scheduledTime` is the
 * round it belonged to. The entry dialog shows the former and falls back to the
 * latter, which is all a pending row needs.
 */
export type TodayPriorReading = {
  scheduledTime: string;
  completedAt: string | null;
  recordedC: number;
};

export type TodayTimelineItem = {
  task: TodayTaskItem;
  isCompleted: boolean;
  /** Completed, but the reading fell outside the equipment's allowed range. */
  isDeviation: boolean;
  /**
   * The most recent reading taken earlier the same day for the same equipment.
   * Derived from the payload we already have — no extra request.
   */
  priorReading: TodayPriorReading | null;
};

/**
 * A round and its tasks, with everything the clock does not affect.
 *
 * Split out from `TodayTimeGroup` so it can be memoised on the response alone.
 * The clock ticks every minute; rebuilding these objects on each tick gave every
 * row a new `item` identity and made `TodayTaskRow`'s memo permanently useless.
 */
export type TodayTaskGroup = {
  /** Also the DOM anchor id, so header chips can scroll to a group. */
  id: string;
  scheduledTime: string;
  items: TodayTimelineItem[];
  total: number;
  completedCount: number;
  remainingCount: number;
  deviationCount: number;
};

export type TodayTimeGroup = TodayTaskGroup & {
  state: TimeGroupState;
  /** Signed minutes from now to this group. Negative means it has passed. */
  minutesUntil: number;
};

/** The clock-independent half of the timeline. */
export type TodayTaskGroups = {
  groups: TodayTaskGroup[];
  total: number;
  completedCount: number;
  remainingCount: number;
  deviationCount: number;
  firstDeviationGroupId: string | null;
  isAllDone: boolean;
};

export type TodayTimeline = {
  groups: TodayTimeGroup[];
  total: number;
  completedCount: number;
  remainingCount: number;
  overdueCount: number;
  deviationCount: number;
  /** Group to scroll to when the page opens. Null when there is nothing left. */
  focusGroupId: string | null;
  firstOverdueGroupId: string | null;
  firstDeviationGroupId: string | null;
  isAllDone: boolean;
  /**
   * Where the live "now" marker sits: render it before `groups[nowLineIndex]`,
   * or after every group when it equals `groups.length`. Null on any day that
   * is not today, where a now marker would be meaningless.
   *
   * Placing it *between* groups rather than inside one keeps it out of the
   * middle of a round that is still live work at 15:12.
   */
  nowLineIndex: number | null;
  /** Minutes since midnight in the org zone, for the marker's label. */
  nowMinutes: number;
};

export function timeGroupId(scheduledTime: string): string {
  return `time-group-${scheduledTime.replace(":", "-")}`;
}

/**
 * Resolves an occurrence key against the current timeline.
 *
 * Anything holding on to a task across renders holds the key rather than the
 * item: the clock ticks every minute and rebuilds the timeline, so a captured
 * item would keep serving the prior reading it happened to see. Null once the
 * key stops resolving — a day that rolled over, or a template that was removed.
 */
export function findTimelineItem(
  timeline: TodayTimeline,
  key: string | null,
): TodayTimelineItem | null {
  if (!key) return null;

  for (const group of timeline.groups) {
    for (const item of group.items) {
      if (occurrenceKey(item.task) === key) return item;
    }
  }

  return null;
}

/** The round an occurrence belongs to, for queueing the rest of its group. */
export function findTimelineGroup(
  timeline: TodayTimeline,
  key: string | null,
): TodayTimeGroup | null {
  if (!key) return null;

  return (
    timeline.groups.find((group) =>
      group.items.some((item) => occurrenceKey(item.task) === key),
    ) ?? null
  );
}

function isDeviation(task: TodayTaskItem): boolean {
  return (
    task.completedAt !== null &&
    task.temperatureReading?.result === "out_of_range"
  );
}

/**
 * Walks the day in chronological order keeping the last reading seen per piece
 * of equipment, so a pending 15:00 check can show what 07:00 measured.
 */
function buildPriorReadings(
  tasksInTimeOrder: TodayTaskItem[],
): Map<string, TodayPriorReading> {
  const priorByTaskKey = new Map<string, TodayPriorReading>();
  const lastByEquipment = new Map<string, TodayPriorReading>();

  for (const task of tasksInTimeOrder) {
    if (!task.equipmentId) continue;

    const previous = lastByEquipment.get(task.equipmentId);
    if (previous) {
      priorByTaskKey.set(
        `${task.templateId}:${task.scheduledTime}`,
        previous,
      );
    }

    if (task.temperatureReading) {
      lastByEquipment.set(task.equipmentId, {
        scheduledTime: task.scheduledTime,
        completedAt: task.completedAt,
        recordedC: task.temperatureReading.recordedC,
      });
    }
  }

  return priorByTaskKey;
}

/**
 * Signed minutes from now to an occurrence, across dates — comparing only the
 * clock would report "in 13h" for tomorrow 07:00 when it is 20:00 tonight.
 */
function minutesUntilOccurrence(
  date: string,
  scheduledTime: string,
  now: Date,
  timeZone: string,
): number {
  const target = wallClockToInstant(date, scheduledTime, timeZone);
  return Math.round((target.getTime() - now.getTime()) / 60_000);
}

function deriveGroupState(params: {
  remainingCount: number;
  scheduledTime: string;
  now: Date;
  selectedDate: string;
  timeZone: string;
}): TimeGroupState {
  const { remainingCount, scheduledTime, now, selectedDate, timeZone } = params;

  if (remainingCount === 0) return "done";

  const todayDate = zonedDateString(now, timeZone);
  if (selectedDate < todayDate) return "overdue";
  if (selectedDate > todayDate) return "upcoming";

  if (isDueNow(scheduledTime, now, timeZone)) return "now";
  return minutesUntilScheduled(scheduledTime, now, timeZone) < 0
    ? "overdue"
    : "upcoming";
}

/**
 * Everything derivable from the day's tasks alone: grouping, per-item state and
 * the counts. Memoise this on the response and the item objects stay
 * referentially stable across clock ticks, which is what lets `TodayTaskRow`'s
 * memo actually bail out.
 */
export function buildTodayTaskGroups(tasks: TodayTaskItem[]): TodayTaskGroups {
  const inTimeOrder = [...tasks].sort(
    (a, b) =>
      parseScheduledTimeToMinutes(a.scheduledTime) -
      parseScheduledTimeToMinutes(b.scheduledTime),
  );
  const priorReadings = buildPriorReadings(inTimeOrder);

  const byTime = new Map<string, TodayTimelineItem[]>();
  for (const task of inTimeOrder) {
    const items = byTime.get(task.scheduledTime) ?? [];
    items.push({
      task,
      isCompleted: task.completedAt !== null,
      isDeviation: isDeviation(task),
      priorReading:
        priorReadings.get(`${task.templateId}:${task.scheduledTime}`) ?? null,
    });
    byTime.set(task.scheduledTime, items);
  }

  const groups: TodayTaskGroup[] = [...byTime.entries()].map(
    ([scheduledTime, items]) => {
      const completedCount = items.filter((item) => item.isCompleted).length;
      const deviationCount = items.filter((item) => item.isDeviation).length;

      return {
        id: timeGroupId(scheduledTime),
        scheduledTime,
        items,
        total: items.length,
        completedCount,
        remainingCount: items.length - completedCount,
        deviationCount,
      };
    },
  );

  const total = tasks.length;
  const completedCount = groups.reduce((sum, g) => sum + g.completedCount, 0);

  return {
    groups,
    total,
    completedCount,
    remainingCount: total - completedCount,
    deviationCount: groups.reduce((sum, g) => sum + g.deviationCount, 0),
    firstDeviationGroupId:
      groups.find((group) => group.deviationCount > 0)?.id ?? null,
    isAllDone: total > 0 && completedCount === total,
  };
}

/**
 * Layers the clock over the task groups: which rounds are live, overdue or still
 * ahead, and where the now marker sits.
 *
 * `items` is carried through by reference — this is the whole point of the
 * split, and the reason a tick no longer re-renders every row.
 */
export function applyClock(
  base: TodayTaskGroups,
  now: Date,
  selectedDate: string,
  timeZone: string,
): TodayTimeline {
  const groups: TodayTimeGroup[] = base.groups.map((group) => ({
    ...group,
    state: deriveGroupState({
      remainingCount: group.remainingCount,
      scheduledTime: group.scheduledTime,
      now,
      selectedDate,
      timeZone,
    }),
    minutesUntil: minutesUntilOccurrence(
      selectedDate,
      group.scheduledTime,
      now,
      timeZone,
    ),
  }));

  const overdueCount = groups
    .filter((group) => group.state === "overdue")
    .reduce((sum, group) => sum + group.remainingCount, 0);

  // The marker belongs before the first round still ahead of the clock. When
  // findIndex comes back empty every round has passed, so it goes at the end.
  const nowMinutes = zonedMinutesOfDay(now, timeZone);
  const isToday = selectedDate === zonedDateString(now, timeZone);
  const upcomingIndex = groups.findIndex(
    (group) => parseScheduledTimeToMinutes(group.scheduledTime) > nowMinutes,
  );

  return {
    groups,
    total: base.total,
    completedCount: base.completedCount,
    remainingCount: base.remainingCount,
    overdueCount,
    deviationCount: base.deviationCount,
    focusGroupId: groups.find((group) => group.state !== "done")?.id ?? null,
    firstOverdueGroupId:
      groups.find((group) => group.state === "overdue")?.id ?? null,
    firstDeviationGroupId: base.firstDeviationGroupId,
    isAllDone: base.isAllDone,
    nowLineIndex:
      isToday && !base.isAllDone
        ? upcomingIndex === -1
          ? groups.length
          : upcomingIndex
        : null,
    nowMinutes,
  };
}

export function buildTodayTimeline(
  tasks: TodayTaskItem[],
  now: Date,
  selectedDate: string,
  timeZone: string,
): TodayTimeline {
  return applyClock(buildTodayTaskGroups(tasks), now, selectedDate, timeZone);
}
