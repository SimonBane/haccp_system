import type { TodayResponse, TodayTaskItem } from "@haccp/shared";
import { computeTodayTaskStatus } from "@haccp/shared";

/** Minutes before/after scheduled time that count as "due now". Easy to tune. */
export const DUE_NOW_WINDOW_MINUTES = 30;

export type TodayUiBucket =
  "attention" | "overdue" | "dueNow" | "upcoming" | "completed";

export type TodayFilter = "todo" | "attention" | "completed" | "all";

export type GroupedTodayTasks = {
  attention: TodayTaskItem[];
  overdue: TodayTaskItem[];
  dueNow: TodayTaskItem[];
  upcoming: TodayTaskItem[];
  completed: TodayTaskItem[];
};

export type TodayFilterCounts = {
  todo: number;
  attention: number;
  completed: number;
  all: number;
};

function parseScheduledTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  return hours * 60 + minutes;
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function occurrenceKey(task: TodayTaskItem): string {
  return `${task.templateId}:${task.scheduledTime}:${task.date}`;
}

export function flatTodayTasks(response: TodayResponse): TodayTaskItem[] {
  return [
    ...response.sections.morning,
    ...response.sections.afternoon,
    ...response.sections.evening,
  ];
}

export function isDueNow(
  scheduledTime: string,
  now: Date,
  windowMinutes: number = DUE_NOW_WINDOW_MINUTES,
): boolean {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const scheduledMinutes = parseScheduledTimeToMinutes(scheduledTime);
  return Math.abs(nowMinutes - scheduledMinutes) <= windowMinutes;
}

export function classifyTodayTask(
  task: TodayTaskItem,
  now: Date,
): TodayUiBucket {
  const status = computeTodayTaskStatus({
    date: task.date,
    scheduledTime: task.scheduledTime,
    now,
    completedAt: task.completedAt,
  });

  if (
    status === "completed" &&
    task.temperatureReading?.result === "out_of_range"
  ) {
    return "attention";
  }
  if (status === "completed") return "completed";
  if (task.date === localIsoDate(now) && isDueNow(task.scheduledTime, now)) {
    return "dueNow";
  }
  if (status === "overdue") return "overdue";
  return "upcoming";
}

function compareByScheduledTimeAsc(a: TodayTaskItem, b: TodayTaskItem): number {
  return (
    parseScheduledTimeToMinutes(a.scheduledTime) -
    parseScheduledTimeToMinutes(b.scheduledTime)
  );
}

export function groupTodayTasks(
  tasks: TodayTaskItem[],
  now: Date,
): GroupedTodayTasks {
  const attention: TodayTaskItem[] = [];
  const overdue: TodayTaskItem[] = [];
  const dueNow: TodayTaskItem[] = [];
  const upcoming: TodayTaskItem[] = [];
  const completed: TodayTaskItem[] = [];

  for (const task of tasks) {
    switch (classifyTodayTask(task, now)) {
      case "attention":
        attention.push(task);
        break;
      case "completed":
        completed.push(task);
        break;
      case "dueNow":
        dueNow.push(task);
        break;
      case "overdue":
        overdue.push(task);
        break;
      case "upcoming":
        upcoming.push(task);
        break;
    }
  }

  attention.sort(compareByScheduledTimeAsc);
  overdue.sort(compareByScheduledTimeAsc);
  dueNow.sort(compareByScheduledTimeAsc);
  upcoming.sort(compareByScheduledTimeAsc);
  completed.sort(compareByScheduledTimeAsc);

  return { attention, overdue, dueNow, upcoming, completed };
}

export function filterCountsFromGrouped(
  grouped: GroupedTodayTasks,
): TodayFilterCounts {
  const attention = grouped.attention.length + grouped.overdue.length;
  const overdue = grouped.overdue.length;
  const dueNow = grouped.dueNow.length;
  const upcoming = grouped.upcoming.length;
  const completed = grouped.completed.length;
  const todo = grouped.attention.length + overdue + dueNow + upcoming;
  const all = todo + completed;

  return { todo, attention, completed, all };
}

export function nextActionableTask(
  grouped: GroupedTodayTasks,
): TodayTaskItem | null {
  return grouped.overdue[0] ?? grouped.dueNow[0] ?? grouped.upcoming[0] ?? null;
}

export function applyTodayFilter(
  grouped: GroupedTodayTasks,
  filter: TodayFilter,
  options?: { includeCompletedWhenAllDone?: boolean },
): GroupedTodayTasks {
  const allDone =
    options?.includeCompletedWhenAllDone === true &&
    grouped.completed.length > 0 &&
    grouped.attention.length === 0 &&
    grouped.overdue.length === 0 &&
    grouped.dueNow.length === 0 &&
    grouped.upcoming.length === 0;

  switch (filter) {
    case "todo":
      return {
        attention: grouped.attention,
        overdue: grouped.overdue,
        dueNow: grouped.dueNow,
        upcoming: grouped.upcoming,
        // Keep completed visible when the day is fully done.
        completed: allDone ? grouped.completed : [],
      };
    case "attention":
      return {
        attention: grouped.attention,
        overdue: grouped.overdue,
        dueNow: [],
        upcoming: [],
        completed: [],
      };
    case "completed":
      return {
        attention: [],
        overdue: [],
        dueNow: [],
        upcoming: [],
        completed: grouped.completed,
      };
    case "all":
      return grouped;
  }
}

export function minutesUntilScheduled(
  scheduledTime: string,
  now: Date,
): number {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const scheduledMinutes = parseScheduledTimeToMinutes(scheduledTime);
  return scheduledMinutes - nowMinutes;
}
