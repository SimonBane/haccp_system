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

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const todayDateQuerySchema = z.object({
  date: isoDateSchema,
});

export type TodayDateQuery = z.infer<typeof todayDateQuerySchema>;

export const todayTaskTemperatureReadingSchema = z
  .object({
    recordedC: z.number(),
    result: z.enum(["ok", "out_of_range"]),
    minTempC: z.number(),
    maxTempC: z.number(),
    correctiveAction: z.string().nullable(),
  })
  .nullable();

export const todayTaskItemSchema = z.object({
  templateId: z.string().uuid(),
  title: z.string(),
  type: taskTemplateTypeSchema,
  equipmentId: z.string().uuid().nullable(),
  equipmentName: z.string().nullable(),
  minTempC: z.number().nullable(),
  maxTempC: z.number().nullable(),
  scheduledTime: scheduledTimeSchema,
  timeSlot: taskTemplateTimeSlotSchema,
  date: isoDateSchema,
  status: todayTaskStatusSchema,
  completedAt: z.string().datetime().nullable(),
  completedBy: userSummarySchema.nullable(),
  temperatureReading: todayTaskTemperatureReadingSchema,
});

export type TodayTaskItem = z.infer<typeof todayTaskItemSchema>;

export const todayResponseSchema = z.object({
  date: isoDateSchema,
  locationId: z.string().uuid(),
  currentUserId: z.string().uuid(),
  sections: z.object({
    morning: z.array(todayTaskItemSchema),
    afternoon: z.array(todayTaskItemSchema),
    evening: z.array(todayTaskItemSchema),
  }),
});

export type TodayResponse = z.infer<typeof todayResponseSchema>;

export const completeTodayTaskSchema = z.object({
  templateId: z.string().uuid(),
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
  // JS: 0=Sunday..6=Saturday
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

  // Use UTC to avoid server timezone shifting the weekday.
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = jsDayToWeekday(utcDate.getUTCDay());

  if (!TASK_TEMPLATE_ALL_WEEKDAYS.includes(weekday)) {
    throw new Error(`Invalid weekday derived from ${date}`);
  }

  return weekday;
}

/**
 * `timeZone` is the organisation's zone, and it is required on purpose: a
 * scheduled time is a wall clock at the site, so reading `now` in the server's
 * or the phone's zone silently mis-reports status for anyone not sitting in it.
 * Making the parameter mandatory lets the compiler find every caller.
 */
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
}): "ok" | "out_of_range" {
  const { recordedC, minTempC, maxTempC } = params;
  return recordedC >= minTempC && recordedC <= maxTempC ? "ok" : "out_of_range";
}

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
}): TodayTaskItem {
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
