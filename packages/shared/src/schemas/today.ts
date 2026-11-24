import { z } from "zod";
import { recordValuesSchema } from "../lib/form-answers.js";
import {
  formAppliesToSchema,
  formVersionSummaryMapSchema,
  itemLimitsSchema,
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
import { RECORD_KIND, recordKindSchema } from "./records.js";
import { targetKindSchema, type TargetKind } from "./target.js";
import { recordCorrectiveSchema, type RecordCorrective } from "./task-record.js";
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

export const todayAreaSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});

export type TodayArea = z.infer<typeof todayAreaSchema>;

export const todayTaskItemSchema = z.object({
  kind: recordKindSchema,
  /** Null for an on-demand entry, which has no scheduled occurrence. */
  occurrenceId: z.uuid().nullable(),
  /** Set whenever a record exists, voided or not, so edits and voids can address it. */
  recordId: z.uuid().nullable(),
  /** Null for an on-demand entry, which is logged against its form, not a task. */
  templateId: z.uuid().nullable(),
  title: z.string(),
  formVersionId: z.uuid(),
  targetId: z.uuid().nullable(),
  targetName: z.string().nullable(),
  targetKind: targetKindSchema.nullable(),
  /** The room the check belongs to: the area itself, or the one holding the component or equipment; null when standalone. */
  area: todayAreaSchema.nullable(),
  resolvedLimits: resolvedLimitsSchema,
  scheduledTime: scheduledTimeSchema,
  timeSlot: taskTemplateTimeSlotSchema,
  date: isoDateSchema,
  /** For an on-demand entry, when it was first logged. */
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
  corrective: recordCorrectiveSchema.nullable().optional(),
});

export type TodayTaskItem = z.infer<typeof todayTaskItemSchema>;

/** A form staff can log whenever it happens; `resolvedLimits` are its defaults, before an item's own range. */
export const todayOnDemandFormSchema = z.object({
  formId: z.uuid(),
  name: z.string(),
  formVersionId: z.uuid(),
  appliesTo: formAppliesToSchema,
  resolvedLimits: resolvedLimitsSchema,
});

export type TodayOnDemandForm = z.infer<typeof todayOnDemandFormSchema>;

/** An item at the location a per-item on-demand form can be logged against. */
export const todayOnDemandItemSchema = z.object({
  targetId: z.uuid(),
  targetName: z.string(),
  limits: itemLimitsSchema,
});

export type TodayOnDemandItem = z.infer<typeof todayOnDemandItemSchema>;

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
  onDemand: z.object({
    forms: z.array(todayOnDemandFormSchema),
    /** Shared by every per-item form: any active item at the location. */
    items: z.array(todayOnDemandItemSchema),
    /** Active on-demand entries on this date, oldest first. */
    entries: z.array(todayTaskItemSchema),
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
  corrective?: RecordCorrective | null;
};

export function buildTodayTaskItemFromOccurrence(params: {
  occurrenceId: string;
  recordId: string | null;
  templateId: string;
  title: string;
  formVersionId: string;
  targetId: string | null;
  targetName: string | null;
  targetKind?: TargetKind | null;
  area?: TodayArea | null;
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
    kind: RECORD_KIND.SCHEDULED,
    occurrenceId: params.occurrenceId,
    recordId: params.recordId,
    templateId: params.templateId,
    title: params.title,
    formVersionId: params.formVersionId,
    targetId: params.targetId,
    targetName: params.targetName,
    targetKind: params.targetKind ?? null,
    area: params.area ?? null,
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
    corrective: answers?.corrective ?? null,
  };
}

export function buildTodayEntryItem(params: {
  recordId: string;
  title: string;
  formVersionId: string;
  targetId: string | null;
  targetName: string | null;
  targetKind?: TargetKind | null;
  area?: TodayArea | null;
  resolvedLimits: TodayTaskItem["resolvedLimits"];
  entryDate: TodayTaskItem["date"];
  entryTime: TodayTaskItem["scheduledTime"];
  createdAt: Date;
  recordedAt: Date;
  recordedBy: z.infer<typeof userSummarySchema> | null;
  answers: TodayRecordAnswers;
}): TodayTaskItem {
  return {
    kind: RECORD_KIND.ON_DEMAND,
    occurrenceId: null,
    recordId: params.recordId,
    templateId: null,
    title: params.title,
    formVersionId: params.formVersionId,
    targetId: params.targetId,
    targetName: params.targetName,
    targetKind: params.targetKind ?? null,
    area: params.area ?? null,
    resolvedLimits: params.resolvedLimits,
    scheduledTime: params.entryTime,
    timeSlot: deriveTimeSlotFromTime(params.entryTime),
    date: params.entryDate,
    availableAt: params.createdAt.toISOString(),
    dueAt: null,
    recordState: RECORD_STATE.ACTIVE,
    status: "completed",
    completedAt: params.recordedAt.toISOString(),
    completedBy: params.recordedBy,
    result: params.answers.result,
    values: params.answers.values,
    correctiveAction: params.answers.correctiveAction,
    corrective: params.answers.corrective ?? null,
  };
}
