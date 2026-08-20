import { z } from "zod";
import {
  deriveTimeSlotFromTime,
  parseScheduledTimeToMinutes,
  scheduledTimeSchema,
  taskTemplateTimeSlotSchema,
  taskTemplateTypeSchema,
  taskTemplateWeekdaySchema,
  TASK_TEMPLATE_ALL_WEEKDAYS,
} from "./task-template.js";
import { userSummarySchema } from "./user.js";
import { zonedDateString, zonedMinutesOfDay } from "../lib/timezone.js";

export const todayTaskStatusSchema = z.enum([
  "pending",
  "completed",
  "overdue",
]);

export type TodayTaskStatus = z.infer<typeof todayTaskStatusSchema>;

export const TEMPERATURE_RESULT = {
  OK: "ok",
  OUT_OF_RANGE: "out_of_range",
} as const;

export const temperatureResultSchema = z.enum([
  TEMPERATURE_RESULT.OK,
  TEMPERATURE_RESULT.OUT_OF_RANGE,
]);

export type TemperatureResult = z.infer<typeof temperatureResultSchema>;

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

export const todayTaskTemperatureReadingSchema = z
  .object({
    recordedC: z.number(),
    result: temperatureResultSchema,
    minTempC: z.number(),
    maxTempC: z.number(),
    correctiveAction: z.string().nullable(),
  })
  .nullable();

export const todayTaskItemSchema = z.object({
  occurrenceId: z.uuid(),
  templateId: z.uuid(),
  title: z.string(),
  type: taskTemplateTypeSchema,
  equipmentId: z.uuid().nullable(),
  equipmentName: z.string().nullable(),
  minTempC: z.number().nullable(),
  maxTempC: z.number().nullable(),
  scheduledTime: scheduledTimeSchema,
  timeSlot: taskTemplateTimeSlotSchema,
  date: isoDateSchema,
  dueAt: z.iso.datetime(),
  recordState: recordStateSchema,
  status: todayTaskStatusSchema,
  completedAt: z.iso.datetime().nullable(),
  completedBy: userSummarySchema.nullable(),
  temperatureReading: todayTaskTemperatureReadingSchema,
});

export type TodayTaskItem = z.infer<typeof todayTaskItemSchema>;

export const todayResponseSchema = z.object({
  date: isoDateSchema,
  locationId: z.uuid(),
  currentUserId: z.uuid(),
  sections: z.object({
    morning: z.array(todayTaskItemSchema),
    afternoon: z.array(todayTaskItemSchema),
    evening: z.array(todayTaskItemSchema),
  }),
});

export type TodayResponse = z.infer<typeof todayResponseSchema>;

export const completeTodayTaskSchema = z.object({
  templateId: z.uuid(),
  date: isoDateSchema,
  scheduledTime: scheduledTimeSchema,
});

export type CompleteTodayTaskInput = z.infer<typeof completeTodayTaskSchema>;

export const completeTodayTemperatureTaskSchema =
  completeTodayTaskSchema.extend({
    recordedC: z.coerce.number(),
    correctiveAction: z.string().trim().max(1000).optional(),
  });

export type CompleteTodayTemperatureTaskInput = z.infer<
  typeof completeTodayTemperatureTaskSchema
>;

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

/** `timeZone` is required: a scheduled time is a wall clock at the site. */
export function computeTodayTaskStatus(params: {
  date: string;
  scheduledTime: string;
  now: Date;
  completedAt: string | null;
  timeZone: string;
}): TodayTaskStatus {
  const { date, scheduledTime, now, completedAt, timeZone } = params;

  if (completedAt) return "completed";

  const nowDate = zonedDateString(now, timeZone);

  if (date < nowDate) return "overdue";
  if (date > nowDate) return "pending";

  const nowMinutes = zonedMinutesOfDay(now, timeZone);
  const scheduledMinutes = parseScheduledTimeToMinutes(scheduledTime);

  if (nowMinutes > scheduledMinutes) return "overdue";
  return "pending";
}

export function classifyTemperatureResult(params: {
  recordedC: number;
  minTempC: number;
  maxTempC: number;
}): TemperatureResult {
  const { recordedC, minTempC, maxTempC } = params;
  return recordedC >= minTempC && recordedC <= maxTempC
    ? TEMPERATURE_RESULT.OK
    : TEMPERATURE_RESULT.OUT_OF_RANGE;
}

/** The template-scan builder predates task_occurrences and has no real occurrence to report — used only by the completion routes HACCP-16 removes. */
export type LegacyTodayTaskItem = Omit<
  TodayTaskItem,
  "occurrenceId" | "recordState" | "dueAt"
>;

export function buildTodayTaskItem(params: {
  templateId: string;
  title: string;
  type: TodayTaskItem["type"];
  equipmentId: string | null;
  equipmentName: string | null;
  minTempC?: number | null;
  maxTempC?: number | null;
  scheduledTime: TodayTaskItem["scheduledTime"];
  date: TodayTaskItem["date"];
  completedAt: string | null;
  completedBy: z.infer<typeof userSummarySchema> | null;
  now: Date;
  timeZone: string;
  temperatureReading?: TodayTaskItem["temperatureReading"];
}): LegacyTodayTaskItem {
  const timeSlot = deriveTimeSlotFromTime(params.scheduledTime);

  return {
    templateId: params.templateId,
    title: params.title,
    type: params.type,
    equipmentId: params.equipmentId,
    equipmentName: params.equipmentName,
    minTempC: params.minTempC ?? null,
    maxTempC: params.maxTempC ?? null,
    scheduledTime: params.scheduledTime,
    timeSlot,
    date: params.date,
    status: computeTodayTaskStatus({
      date: params.date,
      scheduledTime: params.scheduledTime,
      now: params.now,
      completedAt: params.completedAt,
      timeZone: params.timeZone,
    }),
    completedAt: params.completedAt,
    completedBy: params.completedBy,
    temperatureReading: params.temperatureReading ?? null,
  };
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
  dueAt: Date;
  now: Date;
}): TodayTaskStatus {
  if (params.recordState === RECORD_STATE.ACTIVE) return "completed";
  return params.now.getTime() >= params.dueAt.getTime()
    ? "overdue"
    : "pending";
}

export function buildTodayTaskItemFromOccurrence(params: {
  occurrenceId: string;
  templateId: string;
  title: string;
  type: TodayTaskItem["type"];
  equipmentId: string | null;
  equipmentName: string | null;
  minTempC: number | null;
  maxTempC: number | null;
  scheduledTime: TodayTaskItem["scheduledTime"];
  date: TodayTaskItem["date"];
  dueAt: Date;
  now: Date;
  record: ActiveTaskRecordCandidate | null;
  recordedBy: z.infer<typeof userSummarySchema> | null;
  temperatureReading?: TodayTaskItem["temperatureReading"];
}): TodayTaskItem {
  const recordState = deriveRecordState(params.record);
  const active = recordState === RECORD_STATE.ACTIVE;
  const timeSlot = deriveTimeSlotFromTime(params.scheduledTime);

  return {
    occurrenceId: params.occurrenceId,
    templateId: params.templateId,
    title: params.title,
    type: params.type,
    equipmentId: params.equipmentId,
    equipmentName: params.equipmentName,
    minTempC: params.minTempC,
    maxTempC: params.maxTempC,
    scheduledTime: params.scheduledTime,
    timeSlot,
    date: params.date,
    dueAt: params.dueAt.toISOString(),
    recordState,
    status: deriveTodayTaskStatusFromOccurrence({
      recordState,
      dueAt: params.dueAt,
      now: params.now,
    }),
    // A voided record does not satisfy its occurrence — it renders uncompleted and does not expose its old reading.
    completedAt: active ? params.record!.recordedAt.toISOString() : null,
    completedBy: active ? params.recordedBy : null,
    temperatureReading: active ? (params.temperatureReading ?? null) : null,
  };
}
