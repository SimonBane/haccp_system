import type { TodayTaskItem } from "@haccp/shared";
import {
  isDueNow,
  localIsoDate,
  minutesUntilScheduled,
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

export type TodayTimelineItem = {
  task: TodayTaskItem;
  isCompleted: boolean;
  /** Completed, but the reading fell outside the equipment's allowed range. */
  isDeviation: boolean;
  /**
   * The most recent reading taken earlier the same day for the same equipment.
   * Derived from the payload we already have — no extra request.
   */
  priorReading: { scheduledTime: string; recordedC: number } | null;
};

export type TodayTimeGroup = {
  /** Also the DOM anchor id, so header chips can scroll to a group. */
  id: string;
  scheduledTime: string;
  state: TimeGroupState;
  items: TodayTimelineItem[];
  total: number;
  completedCount: number;
  remainingCount: number;
  deviationCount: number;
  /** Signed minutes from now to this group. Negative means it has passed. */
  minutesUntil: number;
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
};

export function timeGroupId(scheduledTime: string): string {
  return `time-group-${scheduledTime.replace(":", "-")}`;
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
): Map<string, { scheduledTime: string; recordedC: number }> {
  const priorByTaskKey = new Map<
    string,
    { scheduledTime: string; recordedC: number }
  >();
  const lastByEquipment = new Map<
    string,
    { scheduledTime: string; recordedC: number }
  >();

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
): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = scheduledTime.split(":").map(Number);
  const target = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60_000);
}

function deriveGroupState(params: {
  remainingCount: number;
  scheduledTime: string;
  now: Date;
  selectedDate: string;
}): TimeGroupState {
  const { remainingCount, scheduledTime, now, selectedDate } = params;

  if (remainingCount === 0) return "done";

  const todayDate = localIsoDate(now);
  if (selectedDate < todayDate) return "overdue";
  if (selectedDate > todayDate) return "upcoming";

  if (isDueNow(scheduledTime, now)) return "now";
  return minutesUntilScheduled(scheduledTime, now) < 0 ? "overdue" : "upcoming";
}

export function buildTodayTimeline(
  tasks: TodayTaskItem[],
  now: Date,
  selectedDate: string,
): TodayTimeline {
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

  const groups: TodayTimeGroup[] = [...byTime.entries()].map(
    ([scheduledTime, items]) => {
      const completedCount = items.filter((item) => item.isCompleted).length;
      const deviationCount = items.filter((item) => item.isDeviation).length;
      const remainingCount = items.length - completedCount;

      return {
        id: timeGroupId(scheduledTime),
        scheduledTime,
        state: deriveGroupState({
          remainingCount,
          scheduledTime,
          now,
          selectedDate,
        }),
        items,
        total: items.length,
        completedCount,
        remainingCount,
        deviationCount,
        minutesUntil: minutesUntilOccurrence(selectedDate, scheduledTime, now),
      };
    },
  );

  const total = tasks.length;
  const completedCount = groups.reduce((sum, g) => sum + g.completedCount, 0);
  const deviationCount = groups.reduce((sum, g) => sum + g.deviationCount, 0);
  const overdueCount = groups
    .filter((group) => group.state === "overdue")
    .reduce((sum, group) => sum + group.remainingCount, 0);

  return {
    groups,
    total,
    completedCount,
    remainingCount: total - completedCount,
    overdueCount,
    deviationCount,
    focusGroupId: groups.find((group) => group.state !== "done")?.id ?? null,
    firstOverdueGroupId:
      groups.find((group) => group.state === "overdue")?.id ?? null,
    firstDeviationGroupId:
      groups.find((group) => group.deviationCount > 0)?.id ?? null,
    isAllDone: total > 0 && completedCount === total,
  };
}
