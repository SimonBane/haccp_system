import { z } from "zod";

export const taskTemplateTypeSchema = z.enum([
  "temperature",
  "cleaning",
  "other",
]);

export type TaskTemplateType = z.infer<typeof taskTemplateTypeSchema>;

export const taskTemplateWeekdaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

export type TaskTemplateWeekday = z.infer<typeof taskTemplateWeekdaySchema>;

export const taskTemplateTimeSlotSchema = z.enum([
  "morning",
  "afternoon",
  "evening",
]);

export type TaskTemplateTimeSlot = z.infer<typeof taskTemplateTimeSlotSchema>;

export const TASK_TEMPLATE_WEEKDAYS: TaskTemplateWeekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export const TASK_TEMPLATE_WEEKDAYS_MON_FRI: TaskTemplateWeekday[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];

export const TASK_TEMPLATE_MINUTES = ["00", "15", "30", "45"] as const;

export type TaskTemplateMinute = (typeof TASK_TEMPLATE_MINUTES)[number];

export const TASK_TEMPLATE_HOURS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);

export const TASK_TEMPLATE_MAX_SCHEDULED_TIMES = 4;

export const TASK_TEMPLATE_SLOT_THRESHOLDS = {
  morningStart: 5 * 60,
  morningEnd: 11 * 60 + 59,
  afternoonStart: 12 * 60,
  afternoonEnd: 16 * 60 + 59,
} as const;

const scheduledTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const scheduledTimeSchema = z
  .string()
  .regex(scheduledTimePattern, "Time must be in HH:MM format");

export function parseScheduledTimeToMinutes(time: string): number {
  const [hourPart, minutePart] = time.split(":");
  return Number(hourPart) * 60 + Number(minutePart);
}

export function composeScheduledTime(hour: string, minute: string): string {
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export const TASK_TEMPLATE_TIME_OPTIONS: string[] = TASK_TEMPLATE_HOURS.flatMap(
  (hour) =>
    TASK_TEMPLATE_MINUTES.map((minute) => composeScheduledTime(hour, minute)),
);

export function normalizeScheduledTimeInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(":");
  if (parts.length !== 2) return null;

  const hour = parts[0].padStart(2, "0");
  const minute = parts[1].padStart(2, "0");
  const candidate = `${hour}:${minute}`;

  return scheduledTimePattern.test(candidate) ? candidate : null;
}

export function splitScheduledTime(
  time: string,
): { hour: string; minute: string } {
  const [hour, minute] = time.split(":");
  return { hour, minute };
}

export function deriveTimeSlotFromTime(time: string): TaskTemplateTimeSlot {
  const minutes = parseScheduledTimeToMinutes(time);
  const { morningStart, morningEnd, afternoonStart, afternoonEnd } =
    TASK_TEMPLATE_SLOT_THRESHOLDS;

  if (minutes >= morningStart && minutes <= morningEnd) {
    return "morning";
  }

  if (minutes >= afternoonStart && minutes <= afternoonEnd) {
    return "afternoon";
  }

  return "evening";
}

export function sortWeekdays(
  weekdays: TaskTemplateWeekday[],
): TaskTemplateWeekday[] {
  const order = new Map(
    TASK_TEMPLATE_WEEKDAYS.map((weekday, index) => [weekday, index]),
  );

  return [...weekdays].sort(
    (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
  );
}

export function sortScheduledTimes(times: string[]): string[] {
  return [...times].sort(
    (a, b) => parseScheduledTimeToMinutes(a) - parseScheduledTimeToMinutes(b),
  );
}

export function formatScheduledTimes(times: string[]): string {
  return sortScheduledTimes(times).join(", ");
}

const taskTemplateFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: taskTemplateTypeSchema,
  weekdays: z
    .array(taskTemplateWeekdaySchema)
    .min(1, "Select at least one weekday")
    .superRefine((value, ctx) => {
      const unique = new Set(value);
      if (unique.size !== value.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Weekdays must be unique",
        });
      }
    }),
  scheduledTimes: z
    .array(scheduledTimeSchema)
    .min(1, "Add at least one time")
    .max(
      TASK_TEMPLATE_MAX_SCHEDULED_TIMES,
      `At most ${TASK_TEMPLATE_MAX_SCHEDULED_TIMES} times per task`,
    )
    .superRefine((value, ctx) => {
      const unique = new Set(value);
      if (unique.size !== value.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Times must be unique",
        });
      }
    }),
  equipmentId: z.string().uuid().nullable().optional(),
});

function withTaskTemplateValidation<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const value = data as {
      type: TaskTemplateType;
      equipmentId?: string | null;
    };

    if (value.type === "temperature" && !value.equipmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Equipment is required for temperature tasks",
        path: ["equipmentId"],
      });
    }

    if (value.type !== "temperature" && value.equipmentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Equipment applies only to temperature tasks",
        path: ["equipmentId"],
      });
    }
  });
}

export const createTaskTemplateSchema = withTaskTemplateValidation(
  taskTemplateFieldsSchema,
);

export type CreateTaskTemplateInput = z.infer<typeof createTaskTemplateSchema>;

export type TaskTemplateFieldsInput = z.infer<typeof taskTemplateFieldsSchema>;

export const updateTaskTemplateSchema = createTaskTemplateSchema;

export type UpdateTaskTemplateInput = CreateTaskTemplateInput;

export const taskTemplateResponseSchema = z.object({
  id: z.string().uuid(),
  locationId: z.string().uuid(),
  title: z.string(),
  type: taskTemplateTypeSchema,
  weekdays: z.array(taskTemplateWeekdaySchema),
  scheduledTimes: z.array(scheduledTimeSchema),
  equipmentId: z.string().uuid().nullable(),
  equipmentName: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TaskTemplateResponse = z.infer<typeof taskTemplateResponseSchema>;

export const taskTemplateListResponseSchema = z.object({
  items: z.array(taskTemplateResponseSchema),
});

export type TaskTemplateListResponse = z.infer<
  typeof taskTemplateListResponseSchema
>;
