import {
  deriveTodayTaskStatusFromOccurrence,
  RECORD_RESULT,
  RECORD_STATE,
  startOfLocalDay,
  zonedDateString,
  zonedTimeString,
  type FormVersionSummary,
  type TodayResponse,
  type TodayTaskItem,
  type TodayTaskStatus,
} from "@haccp/shared";
import { inlineField } from "./inline-check";
import { flatTodayTasks, todayItemKey } from "./today-grouping";

export type TodayCheck = {
  key: string;
  task: TodayTaskItem;
  /** Recomputed from the clock, so a tablet left open does not show a stale state. */
  status: TodayTaskStatus;
  isDone: boolean;
  isDeviation: boolean;
};

/** Org-local "HH:MM" bounds; null on a side the task leaves open. */
export type TaskWindow = { opensAt: string | null; dueAt: string | null };

/** Every check one task asks for at one time: the row staff see. */
export type TodayGroup = {
  key: string;
  templateId: string | null;
  title: string;
  scheduledTime: string;
  form: FormVersionSummary | null;
  checks: TodayCheck[];
  doneCount: number;
  isComplete: boolean;
  hasDeviation: boolean;
  isLate: boolean;
  /** Its window has not opened, so the API would refuse a record. */
  isLocked: boolean;
  /** Null when the task can be done at any time that day. */
  window: TaskWindow | null;
  completedAt: string | null;
  completedBy: TodayTaskItem["completedBy"];
};

export type TodayEntry = {
  key: string;
  task: TodayTaskItem;
  form: FormVersionSummary | null;
  isDeviation: boolean;
};

export type TodayDay = {
  date: string;
  isToday: boolean;
  isFuture: boolean;
  todo: TodayGroup[];
  later: TodayGroup[];
  done: TodayGroup[];
  entries: TodayEntry[];
  total: number;
  doneCount: number;
  deviationCount: number;
};

function isDeviation(task: TodayTaskItem): boolean {
  return (
    task.recordState === RECORD_STATE.ACTIVE &&
    task.result === RECORD_RESULT.FAIL
  );
}

function toCheck(task: TodayTaskItem, now: Date): TodayCheck {
  const isDone = task.recordState === RECORD_STATE.ACTIVE;

  return {
    key: todayItemKey(task),
    task,
    status: isDone
      ? "completed"
      : deriveTodayTaskStatusFromOccurrence({
          recordState: RECORD_STATE.NONE,
          availableAt: new Date(task.availableAt),
          dueAt: task.dueAt === null ? null : new Date(task.dueAt),
          now,
        }),
    isDone,
    isDeviation: isDeviation(task),
  };
}

function windowOf(
  task: TodayTaskItem,
  dayStart: Date,
  timeZone: string,
): TaskWindow | null {
  const availableAt = new Date(task.availableAt);
  const opensAt =
    availableAt.getTime() > dayStart.getTime()
      ? zonedTimeString(availableAt, timeZone)
      : null;
  const dueAt =
    task.dueAt === null
      ? null
      : zonedTimeString(new Date(task.dueAt), timeZone);

  return opensAt === null && dueAt === null ? null : { opensAt, dueAt };
}

function toGroup(
  key: string,
  tasks: TodayTaskItem[],
  response: TodayResponse,
  now: Date,
  dayStart: Date,
  timeZone: string,
): TodayGroup {
  const [first] = tasks as [TodayTaskItem, ...TodayTaskItem[]];
  const checks = tasks.map((task) => toCheck(task, now));
  const open = checks.filter((check) => !check.isDone);
  const latest = checks
    .filter((check) => check.task.completedAt !== null)
    .sort((a, b) =>
      (b.task.completedAt ?? "").localeCompare(a.task.completedAt ?? ""),
    )[0];

  return {
    key,
    templateId: first.templateId,
    title: first.title,
    scheduledTime: first.scheduledTime,
    form: response.formVersions[first.formVersionId] ?? null,
    checks,
    doneCount: checks.length - open.length,
    isComplete: open.length === 0,
    hasDeviation: checks.some((check) => check.isDeviation),
    isLate: open.some((check) => check.status === "overdue"),
    isLocked:
      open.length > 0 && open.every((check) => check.status === "upcoming"),
    window: windowOf(first, dayStart, timeZone),
    completedAt: latest?.task.completedAt ?? null,
    completedBy: latest?.task.completedBy ?? null,
  };
}

function byTime(a: TodayGroup, b: TodayGroup): number {
  return (
    a.scheduledTime.localeCompare(b.scheduledTime) ||
    a.title.localeCompare(b.title)
  );
}

/** Three states for staff: to do, later, done. Late is a flag on a to-do row, never its own list. */
export function buildTodayDay(
  response: TodayResponse,
  now: Date,
  timeZone: string,
): TodayDay {
  const todayDate = zonedDateString(now, timeZone);
  const isToday = response.date === todayDate;
  const nowTime = zonedTimeString(now, timeZone);
  const dayStart = startOfLocalDay(response.date, timeZone);

  const byKey = new Map<string, TodayTaskItem[]>();
  for (const task of flatTodayTasks(response)) {
    const key = `${task.templateId}|${task.scheduledTime}|${task.formVersionId}`;
    const list = byKey.get(key);
    if (list) list.push(task);
    else byKey.set(key, [task]);
  }

  const todo: TodayGroup[] = [];
  const later: TodayGroup[] = [];
  const done: TodayGroup[] = [];

  for (const [key, tasks] of byKey) {
    const group = toGroup(key, tasks, response, now, dayStart, timeZone);
    if (group.isComplete) done.push(group);
    else if (group.isLate) todo.push(group);
    else if (group.isLocked || (isToday && group.scheduledTime > nowTime)) {
      later.push(group);
    } else todo.push(group);
  }

  todo.sort((a, b) => Number(b.isLate) - Number(a.isLate) || byTime(a, b));
  later.sort(byTime);
  done.sort(byTime);

  const entries = response.onDemand.entries.map((task) => ({
    key: todayItemKey(task),
    task,
    form: response.formVersions[task.formVersionId] ?? null,
    isDeviation: isDeviation(task),
  }));

  return {
    date: response.date,
    isToday,
    isFuture: response.date > todayDate,
    todo,
    later,
    done,
    entries,
    total: byKey.size,
    doneCount: done.length,
    deviationCount: done.filter((group) => group.hasDeviation).length,
  };
}

export function findGroup(day: TodayDay, key: string): TodayGroup | null {
  return (
    [...day.todo, ...day.later, ...day.done].find(
      (group) => group.key === key,
    ) ?? null
  );
}

export type CheckShape = "inline" | "items" | "single";

/** One control is answered on each item's row; more open a form, per item when there are several. */
export function checkShape(group: TodayGroup): CheckShape {
  if (group.form && inlineField(group.form.definition)) return "inline";
  return group.checks.length > 1 ? "items" : "single";
}

export type CheckRow = { check: TodayCheck; label: string };

export type CheckAreaGroup = {
  key: string;
  /** Null when a heading would only repeat the single row under it. */
  heading: string | null;
  rows: CheckRow[];
};

const AREA_SEPARATOR = " › ";

/** Rooms become headings; a room with one check keeps its full name on the row instead. */
export function groupChecksByArea(
  checks: readonly TodayCheck[],
  labels: { wholeRoom: string; fallback: string },
): CheckAreaGroup[] {
  const byArea = new Map<string, TodayCheck[]>();
  for (const check of checks) {
    const key = check.task.area?.id ?? "";
    const list = byArea.get(key);
    if (list) list.push(check);
    else byArea.set(key, [check]);
  }

  return [...byArea].map(([key, list]) => {
    const area = list[0]?.task.area ?? null;
    const grouped = area !== null && list.length > 1;

    return {
      key,
      heading: grouped ? area.name : null,
      rows: list.map((check) => {
        const name = check.task.targetName ?? labels.fallback;
        if (!grouped) return { check, label: name };
        if (check.task.targetId === area.id) {
          return { check, label: labels.wholeRoom };
        }
        const prefix = `${area.name}${AREA_SEPARATOR}`;
        return {
          check,
          label: name.startsWith(prefix) ? name.slice(prefix.length) : name,
        };
      }),
    };
  });
}
