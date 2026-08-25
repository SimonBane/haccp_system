import { z } from "zod";
import {
  addCalendarDays,
  compareCalendarDates,
  isCalendarDate,
} from "../lib/calendar-date.js";
import {
  createGridFilterSchema,
  createGridPageSchema,
  createGridQuerySchema,
  SORT_ORDER,
} from "./grid.js";
import {
  scheduledTimeSchema,
  taskTemplateTypeSchema,
} from "./task-template.js";
import { temperatureResultSchema } from "./today.js";
import { userSummarySchema } from "./user.js";

export const RECORD_DISPLAY_STATE = {
  SUBMITTED: "submitted",
  MISSED: "missed",
  VOIDED: "voided",
} as const;

export const recordDisplayStateSchema = z.enum([
  RECORD_DISPLAY_STATE.SUBMITTED,
  RECORD_DISPLAY_STATE.MISSED,
  RECORD_DISPLAY_STATE.VOIDED,
]);

export type RecordDisplayState = z.infer<typeof recordDisplayStateSchema>;

export const RECORD_ENTRY_STATE = {
  NONE: "none",
  SUBMITTED: "submitted",
  VOIDED: "voided",
} as const;

export const recordEntryStateSchema = z.enum([
  RECORD_ENTRY_STATE.NONE,
  RECORD_ENTRY_STATE.SUBMITTED,
  RECORD_ENTRY_STATE.VOIDED,
]);

export type RecordEntryState = z.infer<typeof recordEntryStateSchema>;

export const RECORD_TIMING = {
  NOT_SUBMITTED: "not_submitted",
  ON_TIME: "on_time",
  LATE: "late",
} as const;

export const recordTimingSchema = z.enum([
  RECORD_TIMING.NOT_SUBMITTED,
  RECORD_TIMING.ON_TIME,
  RECORD_TIMING.LATE,
]);

export type RecordTiming = z.infer<typeof recordTimingSchema>;

export const RECORD_RESULT = {
  PASS: "pass",
  FAIL: "fail",
  NOT_EVALUATED: "not_evaluated",
} as const;

export const recordResultSchema = z.enum([
  RECORD_RESULT.PASS,
  RECORD_RESULT.FAIL,
  RECORD_RESULT.NOT_EVALUATED,
]);

export type RecordResult = z.infer<typeof recordResultSchema>;

export function isRealCalendarDate(value: string): boolean {
  return isCalendarDate(value) && addCalendarDays(value, 0) === value;
}

export const recordsCalendarDateSchema = z
  .string()
  .refine(isRealCalendarDate, { error: "Date must be a real YYYY-MM-DD date" });

export const RECORDS_SORT_FIELDS = ["scheduledAt", "title"] as const;

export type RecordsSortField = (typeof RECORDS_SORT_FIELDS)[number];

export const RECORDS_DEFAULT_SORT = {
  sortBy: "scheduledAt",
  sortOrder: SORT_ORDER.ASC,
} as const;

export const RECORDS_TYPE_FILTER_VALUES = [
  "temperature",
  "cleaning",
] as const;

export const RECORDS_STATE_FILTER_VALUES = [
  RECORD_DISPLAY_STATE.SUBMITTED,
  RECORD_DISPLAY_STATE.MISSED,
  RECORD_DISPLAY_STATE.VOIDED,
] as const;

export const RECORDS_RESULT_FILTER_VALUES = [
  RECORD_RESULT.PASS,
  RECORD_RESULT.FAIL,
  RECORD_RESULT.NOT_EVALUATED,
] as const;

export const RECORDS_DEFAULT_RANGE_DAYS = 7;

export function defaultRecordsDateRange(today: string): {
  dateFrom: string;
  dateTo: string;
} {
  return {
    dateFrom: addCalendarDays(today, -(RECORDS_DEFAULT_RANGE_DAYS - 1)),
    dateTo: today,
  };
}

export const RECORDS_DATE_RANGE_ERROR = {
  INVALID: "invalid",
  ORDER: "order",
  FUTURE: "future",
} as const;

export type RecordsDateRangeError =
  (typeof RECORDS_DATE_RANGE_ERROR)[keyof typeof RECORDS_DATE_RANGE_ERROR];

/**
 * `today` is the organization-local calendar date, captured once by the caller —
 * a runtime-local `Date` would reject or accept the wrong day near midnight.
 */
export function validateRecordsDateRange(input: {
  dateFrom: string;
  dateTo: string;
  today: string;
}): RecordsDateRangeError | null {
  if (
    !isRealCalendarDate(input.dateFrom) ||
    !isRealCalendarDate(input.dateTo)
  ) {
    return RECORDS_DATE_RANGE_ERROR.INVALID;
  }

  if (compareCalendarDates(input.dateFrom, input.dateTo) > 0) {
    return RECORDS_DATE_RANGE_ERROR.ORDER;
  }

  if (compareCalendarDates(input.dateTo, input.today) > 0) {
    return RECORDS_DATE_RANGE_ERROR.FUTURE;
  }

  return null;
}

export const recordsListQuerySchema = createGridQuerySchema({
  sortFields: RECORDS_SORT_FIELDS,
  search: false,
  filters: {
    type: createGridFilterSchema(RECORDS_TYPE_FILTER_VALUES),
    state: createGridFilterSchema(RECORDS_STATE_FILTER_VALUES),
    result: createGridFilterSchema(RECORDS_RESULT_FILTER_VALUES),
  },
})
  .safeExtend({
    dateFrom: recordsCalendarDateSchema,
    dateTo: recordsCalendarDateSchema,
  })
  .check((ctx) => {
    const { dateFrom, dateTo } = ctx.value;

    if (
      isCalendarDate(dateFrom) &&
      isCalendarDate(dateTo) &&
      compareCalendarDates(dateFrom, dateTo) > 0
    ) {
      ctx.issues.push({
        code: "custom",
        message: "dateFrom must be on or before dateTo",
        path: ["dateFrom"],
        input: ctx.value,
      });
    }
  });

export type RecordsListQuery = z.infer<typeof recordsListQuerySchema>;

export const recordTemperatureDetailSchema = z.object({
  recordedC: z.number(),
  minTempC: z.number(),
  maxTempC: z.number(),
  result: temperatureResultSchema,
  correctiveAction: z.string().nullable(),
});

export type RecordTemperatureDetail = z.infer<
  typeof recordTemperatureDetailSchema
>;

export const recordDetailSchema = z.object({
  recordId: z.uuid(),
  createdAt: z.iso.datetime(),
  createdBy: userSummarySchema.nullable(),
  recordedAt: z.iso.datetime(),
  recordedBy: userSummarySchema.nullable(),
  voidedAt: z.iso.datetime().nullable(),
  voidedBy: userSummarySchema.nullable(),
  temperature: recordTemperatureDetailSchema.nullable(),
});

export type RecordDetail = z.infer<typeof recordDetailSchema>;

export const recordItemSchema = z.object({
  occurrenceId: z.uuid(),
  taskTemplateId: z.uuid(),
  occurrenceDate: recordsCalendarDateSchema,
  scheduledTime: scheduledTimeSchema,
  dueAt: z.iso.datetime(),
  title: z.string(),
  type: taskTemplateTypeSchema,
  equipmentId: z.uuid().nullable(),
  equipmentName: z.string().nullable(),
  minTempC: z.number().nullable(),
  maxTempC: z.number().nullable(),
  displayState: recordDisplayStateSchema,
  recordState: recordEntryStateSchema,
  timing: recordTimingSchema,
  result: recordResultSchema,
  record: recordDetailSchema.nullable(),
});

export type RecordItem = z.infer<typeof recordItemSchema>;

export const recordsListResponseSchema = createGridPageSchema(recordItemSchema);

export type RecordsListResponse = z.infer<typeof recordsListResponseSchema>;

export type RecordEligibilityInput = {
  hasRecord: boolean;
  dueAt: Date;
  now: Date;
};

/** Records holds audit evidence: submitted or voided immediately, missed once due. */
export function isRecordEligible(input: RecordEligibilityInput): boolean {
  return input.hasRecord || input.dueAt.getTime() <= input.now.getTime();
}

export function deriveRecordEntryState(
  record: { voidedAt: Date | null } | null,
): RecordEntryState {
  if (!record) return RECORD_ENTRY_STATE.NONE;
  return record.voidedAt === null
    ? RECORD_ENTRY_STATE.SUBMITTED
    : RECORD_ENTRY_STATE.VOIDED;
}

export function deriveRecordDisplayState(
  record: { voidedAt: Date | null } | null,
): RecordDisplayState {
  if (!record) return RECORD_DISPLAY_STATE.MISSED;
  return record.voidedAt === null
    ? RECORD_DISPLAY_STATE.SUBMITTED
    : RECORD_DISPLAY_STATE.VOIDED;
}

/** A voided record has no active submission, so it carries no timing claim. */
export function deriveRecordTiming(input: {
  record: { recordedAt: Date; voidedAt: Date | null } | null;
  dueAt: Date;
}): RecordTiming {
  const { record } = input;

  if (!record || record.voidedAt !== null) {
    return RECORD_TIMING.NOT_SUBMITTED;
  }

  return record.recordedAt.getTime() <= input.dueAt.getTime()
    ? RECORD_TIMING.ON_TIME
    : RECORD_TIMING.LATE;
}

/** The retained temperature payload describes the reading even when the record is voided. */
export function deriveRecordResult(
  temperature: { result: z.infer<typeof temperatureResultSchema> } | null,
): RecordResult {
  if (!temperature) return RECORD_RESULT.NOT_EVALUATED;
  return temperature.result === "ok" ? RECORD_RESULT.PASS : RECORD_RESULT.FAIL;
}
