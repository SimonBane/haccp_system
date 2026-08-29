import {
  TASK_TEMPLATE_COMPLETION_OPENS_BEFORE_DEFAULT_MINUTES,
} from "@haccp/shared";

const MINUTES_INPUT_PATTERN = /^\d{0,4}$/;

export const CUSTOM_MINUTES_INITIAL_VALUE = "30";

export function isAllowedMinutesInput(raw: string): boolean {
  return MINUTES_INPUT_PATTERN.test(raw);
}

export function parseMinutesValue(raw: string): number | null {
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

export function isFromStartOfDay(opensBeforeMinutes: number): boolean {
  return opensBeforeMinutes >= TASK_TEMPLATE_COMPLETION_OPENS_BEFORE_DEFAULT_MINUTES;
}

type AvailableSummaryLabels = {
  fromStartOfDay: string;
  opensBefore: (minutes: number) => string;
};

type DeadlineSummaryLabels = {
  neverOverdue: string;
  overdueAfter: (minutes: number) => string;
};

export type CompactWindowSummaryLabels = AvailableSummaryLabels &
  DeadlineSummaryLabels;

function formatAvailableLabel(
  opensBeforeMinutes: number,
  labels: AvailableSummaryLabels,
): string {
  return isFromStartOfDay(opensBeforeMinutes)
    ? labels.fromStartOfDay
    : labels.opensBefore(opensBeforeMinutes);
}

function formatDeadlineLabel(
  dueAfterMinutes: number | null,
  labels: DeadlineSummaryLabels,
): string {
  return dueAfterMinutes === null
    ? labels.neverOverdue
    : labels.overdueAfter(dueAfterMinutes);
}

/** Compact "available · deadline" summary for admin grid rows and the mobile card. */
export function formatCompactWindowSummary(params: {
  completionOpensBeforeMinutes: number;
  completionDueAfterMinutes: number | null;
  labels: CompactWindowSummaryLabels;
}): string {
  const opensPart = formatAvailableLabel(
    params.completionOpensBeforeMinutes,
    params.labels,
  );
  const duePart = formatDeadlineLabel(
    params.completionDueAfterMinutes,
    params.labels,
  );

  return `${opensPart} · ${duePart}`;
}

export const COMPLETION_OPENS_PRESET_ORDER = [
  "min30",
  "min60",
  "min120",
  "atScheduledTime",
  "startOfDay",
  "custom",
] as const;

export type CompletionOpensPreset = (typeof COMPLETION_OPENS_PRESET_ORDER)[number];

export const COMPLETION_OPENS_PRESET_MINUTES: Record<
  Exclude<CompletionOpensPreset, "custom">,
  number
> = {
  min30: 30,
  min60: 60,
  min120: 120,
  atScheduledTime: 0,
  startOfDay: TASK_TEMPLATE_COMPLETION_OPENS_BEFORE_DEFAULT_MINUTES,
};

export function getOpensPreset(minutes: number | null): CompletionOpensPreset {
  if (minutes === null) return "custom";

  const preset = COMPLETION_OPENS_PRESET_ORDER.find(
    (candidate) =>
      candidate !== "custom" && COMPLETION_OPENS_PRESET_MINUTES[candidate] === minutes,
  );

  return preset ?? "custom";
}

export const COMPLETION_DUE_PRESET_ORDER = [
  "min30",
  "min60",
  "min120",
  "atScheduledTime",
  "never",
  "custom",
] as const;

export type CompletionDuePreset = (typeof COMPLETION_DUE_PRESET_ORDER)[number];

export const COMPLETION_DUE_PRESET_MINUTES: Record<
  Exclude<CompletionDuePreset, "custom" | "never">,
  number
> = {
  min30: 30,
  min60: 60,
  min120: 120,
  atScheduledTime: 0,
};

export function getDuePreset(
  minutes: number | null,
  neverOverdue: boolean,
): CompletionDuePreset {
  if (neverOverdue) return "never";
  if (minutes === null) return "custom";

  const preset = COMPLETION_DUE_PRESET_ORDER.find(
    (candidate) =>
      candidate !== "custom" &&
      candidate !== "never" &&
      COMPLETION_DUE_PRESET_MINUTES[candidate] === minutes,
  );

  return preset ?? "custom";
}

export function resolveOpensPreset(raw: string): CompletionOpensPreset | null {
  const minutes = parseMinutesValue(raw);
  return minutes === null ? null : getOpensPreset(minutes);
}

export function resolveDuePreset(
  raw: string,
  neverOverdue: boolean,
): CompletionDuePreset | null {
  if (neverOverdue) return "never";
  const minutes = parseMinutesValue(raw);
  return minutes === null ? null : getDuePreset(minutes, false);
}
