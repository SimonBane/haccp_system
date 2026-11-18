import {
  TASK_TEMPLATE_ALL_WEEKDAYS,
  TASK_TEMPLATE_MAX_SCHEDULED_TIMES,
  TASK_TEMPLATE_WEEKDAYS,
  parseScheduledTimeToMinutes,
  sortScheduledTimes,
  type TaskTemplateWeekday,
} from "@haccp/shared";

const MINUTES_PER_DAY = 1440;

export const REPEAT_INTERVALS = [30, 60, 120, 180, 240, 360] as const;

export type DayPreset = "every" | "weekdays" | "weekends";

export const WEEKEND_DAYS: TaskTemplateWeekday[] = ["saturday", "sunday"];

const PRESET_DAYS: Record<DayPreset, readonly TaskTemplateWeekday[]> = {
  every: TASK_TEMPLATE_ALL_WEEKDAYS,
  weekdays: TASK_TEMPLATE_WEEKDAYS,
  weekends: WEEKEND_DAYS,
};

export function minutesToTime(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  return `${hours}:${String(wrapped % 60).padStart(2, "0")}`;
}

export function daysForPreset(preset: DayPreset): TaskTemplateWeekday[] {
  return [...PRESET_DAYS[preset]];
}

export function matchDayPreset(days: readonly TaskTemplateWeekday[]): DayPreset | null {
  const set = new Set(days);
  for (const preset of ["every", "weekdays", "weekends"] as const) {
    const expected = PRESET_DAYS[preset];
    if (set.size === expected.length && expected.every((day) => set.has(day))) {
      return preset;
    }
  }
  return null;
}

/** Every `every` minutes from `from` up to and including `until`; empty when the range is backwards. */
export function generateRepeatTimes(every: number, from: string, until: string): string[] {
  if (!from || !until || every <= 0) return [];
  const end = parseScheduledTimeToMinutes(until);
  const times: string[] = [];
  for (
    let minute = parseScheduledTimeToMinutes(from);
    minute <= end && times.length < TASK_TEMPLATE_MAX_SCHEDULED_TIMES;
    minute += every
  ) {
    times.push(minutesToTime(minute));
  }
  return times;
}

/** The repeat interval when 3+ times are evenly spaced by one of the offered intervals, so editing reopens "Repeat every". */
export function detectRepeatInterval(times: readonly string[]): number | null {
  if (times.length < 3) return null;
  const minutes = sortScheduledTimes([...times]).map(parseScheduledTimeToMinutes);
  const gap = minutes[1]! - minutes[0]!;
  for (let index = 2; index < minutes.length; index += 1) {
    if (minutes[index]! - minutes[index - 1]! !== gap) return null;
  }
  return (REPEAT_INTERVALS as readonly number[]).includes(gap) ? gap : null;
}

export function smallestGap(times: readonly string[]): number | null {
  if (times.length < 2) return null;
  const minutes = sortScheduledTimes([...times]).map(parseScheduledTimeToMinutes);
  let gap = Infinity;
  for (let index = 1; index < minutes.length; index += 1) {
    gap = Math.min(gap, minutes[index]! - minutes[index - 1]!);
  }
  return gap;
}

/** True when the next check opens before the previous one is overdue; a window with no deadline never overlaps by design. */
export function windowsOverlap(
  times: readonly string[],
  opensBefore: number,
  dueAfter: number | null,
): boolean {
  if (dueAfter === null) return false;
  const gap = smallestGap(times);
  return gap !== null && gap < opensBefore + dueAfter;
}

export function opensAt(time: string, opensBefore: number): string {
  return minutesToTime(Math.max(0, parseScheduledTimeToMinutes(time) - opensBefore));
}

export function overdueAt(time: string, dueAfter: number): string {
  return minutesToTime(
    Math.min(MINUTES_PER_DAY - 1, parseScheduledTimeToMinutes(time) + dueAfter),
  );
}

export type TimelineMark = { time: string; left: number };
export type TimelineBar = { left: number; width: number };

/** Positions in percent of a 24 h strip; with no window there are no bars and every check is open all day. */
export function buildTimeline(
  times: readonly string[],
  window: { opensBefore: number; dueAfter: number | null } | null,
): { marks: TimelineMark[]; bars: TimelineBar[] } {
  const marks = times.map((time) => ({
    time,
    left: (parseScheduledTimeToMinutes(time) / MINUTES_PER_DAY) * 100,
  }));
  if (!window) return { marks, bars: [] };

  const bars = times.map((time) => {
    const minute = parseScheduledTimeToMinutes(time);
    const start = Math.max(0, minute - window.opensBefore);
    const end =
      window.dueAfter === null
        ? MINUTES_PER_DAY
        : Math.min(MINUTES_PER_DAY, minute + window.dueAfter);
    return {
      left: (start / MINUTES_PER_DAY) * 100,
      width: Math.max(0.5, ((end - start) / MINUTES_PER_DAY) * 100),
    };
  });
  return { marks, bars };
}
