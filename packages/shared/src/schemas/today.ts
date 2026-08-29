import { z } from "zod";
import {
  deriveTimeSlotFromTime,
  scheduledTimeSchema,
  taskTemplateTimeSlotSchema,
  taskTemplateTypeSchema,
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
  availableAt: z.iso.datetime(),
  dueAt: z.iso.datetime().nullable(),
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
  availableAt: Date;
  dueAt: Date | null;
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
    availableAt: params.availableAt.toISOString(),
    dueAt: params.dueAt === null ? null : params.dueAt.toISOString(),
    recordState,
    status: deriveTodayTaskStatusFromOccurrence({
      recordState,
      availableAt: params.availableAt,
      dueAt: params.dueAt,
      now: params.now,
    }),
    // A voided record does not satisfy its occurrence — it renders uncompleted and does not expose its old reading.
    completedAt: active ? params.record!.recordedAt.toISOString() : null,
    completedBy: active ? params.recordedBy : null,
    temperatureReading: active ? (params.temperatureReading ?? null) : null,
  };
}
