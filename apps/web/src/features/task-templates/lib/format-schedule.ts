import {
  TASK_TEMPLATE_WEEKDAYS,
  TASK_TEMPLATE_WEEKDAYS_MON_FRI,
  type TaskTemplateWeekday,
} from "@haccp/shared";

function arraysEqual<T>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function isEveryDayWeekdays(weekdays: TaskTemplateWeekday[]): boolean {
  return arraysEqual([...weekdays].sort(), [...TASK_TEMPLATE_WEEKDAYS].sort());
}

export function isMonFriWeekdays(weekdays: TaskTemplateWeekday[]): boolean {
  return arraysEqual(
    [...weekdays].sort(),
    [...TASK_TEMPLATE_WEEKDAYS_MON_FRI].sort(),
  );
}

export function formatWeekdaysLabel(
  weekdays: TaskTemplateWeekday[],
  labels: {
    everyDay: string;
    monFri: string;
    formatShort: (weekday: TaskTemplateWeekday) => string;
  },
): string {
  if (isEveryDayWeekdays(weekdays)) {
    return labels.everyDay;
  }

  if (isMonFriWeekdays(weekdays)) {
    return labels.monFri;
  }

  const order = new Map(
    TASK_TEMPLATE_WEEKDAYS.map((weekday, index) => [weekday, index]),
  );

  return [...weekdays]
    .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    .map((weekday) => labels.formatShort(weekday))
    .join(", ");
}

export function formatScheduleSummary(
  weekdays: TaskTemplateWeekday[],
  scheduledTimes: string[],
  labels: {
    everyDay: string;
    monFri: string;
    formatShort: (weekday: TaskTemplateWeekday) => string;
  },
): string {
  const weekdayLabel = formatWeekdaysLabel(weekdays, labels);
  const timesLabel = [...scheduledTimes].sort().join(", ");
  return `${weekdayLabel} · ${timesLabel}`;
}
