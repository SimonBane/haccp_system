import { z } from "zod";
import { recordValuesSchema } from "../lib/form-answers.js";
import {
  formVersionSummaryMapSchema,
  recordResultSchema,
  resolvedLimitsSchema,
} from "./form.js";
import {
  deriveTimeSlotFromTime,
  scheduledTimeSchema,
  taskTemplateTimeSlotSchema,
  taskTemplateWeekdaySchema,
  TASK_TEMPLATE_ALL_WEEKDAYS,
} from "./task-template.js";
import { userSummarySchema } from "./user.js";

export const todayTaskStatusSchema = z.enum([
  "upcoming",
  "pending",
  "completed",
  "overdue",
]);

export type TodayTaskStatus = z.infer<typeof todayTaskStatusSchema>;

export const RECORD_STATE = {
  NONE: "none",
  ACTIVE: "active",
  VOIDED: "voided",
} as const;

export const recordStateSchema = z.enum([
  RECORD_STATE.NONE,
  RECORD_STATE.ACTIVE,
  RECORD_STATE.VOIDED,
]);

export type RecordState = z.infer<typeof recordStateSchema>;

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Date must be YYYY-MM-DD" });

export const todayDateQuerySchema = z.object({
  date: isoDateSchema,
});

export type TodayDateQuery = z.infer<typeof todayDateQuerySchema>;

export const todayTaskItemSchema = z.object({
  occurrenceId: z.uuid(),
  templateId: z.uuid(),
  title: z.string(),
  formVersionId: z.uuid(),
  targetId: z.uuid().nullable(),
  targetName: z.string().nullable(),
  resolvedLimits: resolvedLimitsSchema,
  scheduledTime: scheduledTimeSchema,
  timeSlot: taskTemplateTimeSlotSchema,
  date: isoDateSchema,
  availableAt: z.iso.datetime(),
  dueAt: z.iso.datetime().nullable(),
  recordState: recordStateSchema,
  status: todayTaskStatusSchema,
  completedAt: z.iso.datetime().nullable(),
  completedBy: userSummarySchema.nullable(),
  /** Only an active record's answers; a voided record renders as not done. */
  result: recordResultSchema.nullable(),
  values: recordValuesSchema.nullable(),
  correctiveAction: z.string().nullable(),
});

export type TodayTaskItem = z.infer<typeof todayTaskItemSchema>;

export const todayResponseSchema = z.object({
  date: isoDateSchema,
  locationId: z.uuid(),
  currentUserId: z.uuid(),
  formVersions: formVersionSummaryMapSchema,
  sections: z.object({
    morning: z.array(todayTaskItemSchema),
    afternoon: z.array(todayTaskItemSchema),
    evening: z.array(todayTaskItemSchema),
  }),
});

export type TodayResponse = z.infer<typeof todayResponseSchema>;

function jsDayToWeekday(
  day: number,
): z.infer<typeof taskTemplateWeekdaySchema> {
  // JS weekday 0=Sunday.
  const map: Array<z.infer<typeof taskTemplateWeekdaySchema>> = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return map[day]!;
}

export function getWeekdayFromDate(
  date: string,
): z.infer<typeof taskTemplateWeekdaySchema> {
  const [yearS, monthS, dayS] = date.split("-");
  const year = Number(yearS);
  const month = Number(monthS);
  const day = Number(dayS);

  // Parse the calendar date in UTC so the server zone cannot shift the weekday.
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = jsDayToWeekday(utcDate.getUTCDay());

  if (!TASK_TEMPLATE_ALL_WEEKDAYS.includes(weekday)) {
    throw new Error(`Invalid weekday derived from ${date}`);
  }

  return weekday;
}

export type ActiveTaskRecordCandidate = {
  recordedAt: Date;
  voidedAt: Date | null;
};

export function deriveRecordState(
  record: ActiveTaskRecordCandidate | null,
): RecordState {
  if (!record) return RECORD_STATE.NONE;
  return record.voidedAt === null ? RECORD_STATE.ACTIVE : RECORD_STATE.VOIDED;
}

export function deriveTodayTaskStatusFromOccurrence(params: {
  recordState: RecordState;
  availableAt: Date;
  dueAt: Date | null;
  now: Date;
}): TodayTaskStatus {
  if (params.recordState === RECORD_STATE.ACTIVE) return "completed";
  if (params.now.getTime() < params.availableAt.getTime()) return "upcoming";
  if (params.dueAt !== null && params.now.getTime() >= params.dueAt.getTime()) {
    return "overdue";
  }
  return "pending";
}

export type TodayRecordAnswers = {
  result: TodayTaskItem["result"];
  values: TodayTaskItem["values"];
  correctiveAction: string | null;
};

export function buildTodayTaskItemFromOccurrence(params: {
  occurrenceId: string;
  templateId: string;
  title: string;
  formVersionId: string;
  targetId: string | null;
  targetName: string | null;
  resolvedLimits: TodayTaskItem["resolvedLimits"];
  scheduledTime: TodayTaskItem["scheduledTime"];
  date: TodayTaskItem["date"];
  availableAt: Date;
  dueAt: Date | null;
  now: Date;
  record: ActiveTaskRecordCandidate | null;
  recordedBy: z.infer<typeof userSummarySchema> | null;
  answers?: TodayRecordAnswers | null;
}): TodayTaskItem {
  const recordState = deriveRecordState(params.record);
  const active = recordState === RECORD_STATE.ACTIVE;
  const timeSlot = deriveTimeSlotFromTime(params.scheduledTime);
  const answers = active ? (params.answers ?? null) : null;

  return {
    occurrenceId: params.occurrenceId,
    templateId: params.templateId,
    title: params.title,
    formVersionId: params.formVersionId,
    targetId: params.targetId,
    targetName: params.targetName,
    resolvedLimits: params.resolvedLimits,
    scheduledTime: params.scheduledTime,
    timeSlot,
    date: params.date,
    availableAt: params.availableAt.toISOString(),
    dueAt: params.dueAt === null ? null : params.dueAt.toISOString(),
    recordState,
    status: deriveTodayTaskStatusFromOccurrence({
      recordState,
      availableAt: params.availableAt,
      dueAt: params.dueAt,
      now: params.now,
    }),
    completedAt: active ? params.record!.recordedAt.toISOString() : null,
    completedBy: active ? params.recordedBy : null,
    result: answers?.result ?? null,
    values: answers?.values ?? null,
    correctiveAction: answers?.correctiveAction ?? null,
  };
}
