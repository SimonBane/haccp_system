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

export type TimeGroupState = "done" | "overdue" | "now" | "upcoming";

export type TodayPriorReading = {
  scheduledTime: string;
  completedAt: string | null;
  recordedC: number;
};

export type TodayTimelineItem = {
  task: TodayTaskItem;
  isCompleted: boolean;
  isDeviation: boolean;
  priorReading: TodayPriorReading | null;
};

export type TodayTaskGroup = {
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
  minutesUntil: number;
};

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
  focusGroupId: string | null;
  firstOverdueGroupId: string | null;
  firstDeviationGroupId: string | null;
  isAllDone: boolean;
  /** Index to render the now marker before, or `groups.length` when every round has passed. Null when not today. */
  nowLineIndex: number | null;
  nowMinutes: number;
};

export function timeGroupId(scheduledTime: string): string {
  return `time-group-${scheduledTime.replace(":", "-")}`;
}

export function isFutureSelection(
  selectedDate: string,
  now: Date,
  timeZone: string,
): boolean {
  return selectedDate > zonedDateString(now, timeZone);
}

export function isStaleResponse(
  responseDate: string | undefined,
  selectedDate: string,
): boolean {
  return responseDate === undefined || responseDate !== selectedDate;
}

/** Resolve a key against the current timeline — hold the key, not the item, because ticks rebuild it. */
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

/** Last same-equipment reading earlier in the day, so a pending 15:00 can show what 07:00 measured. */
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

/** Across dates — comparing only the clock would report "in 13h" for tomorrow 07:00 at 20:00 tonight. */
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

/** Grouping and counts from the response alone so item identity survives clock ticks. */
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

/** Layers live state on the groups; `items` is carried by reference so a tick does not re-render every row. */
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

  // Before the first round still ahead of the clock, or at the end when every round has passed.
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
