import { z } from "zod";
import {
  addCalendarDays,
  compareCalendarDates,
  isCalendarDate,
} from "../lib/calendar-date.js";
import {
  createGridFilterSchema,
  createGridIdFilterSchema,
  createGridPageSchema,
  createGridQuerySchema,
  SORT_ORDER,
} from "./grid.js";
import { recordValuesSchema } from "../lib/form-answers.js";
import {
  FORM_CATEGORY_VALUES,
  formCategorySchema,
  formVersionSummaryMapSchema,
  RECORD_RESULT,
  recordResultSchema,
  resolvedLimitsSchema,
  type RecordResult,
} from "./form.js";
import { targetKindSchema } from "./target.js";
import { scheduledTimeSchema } from "./task-template.js";
import { userSummarySchema } from "./user.js";

export const RECORD_KIND = {
  SCHEDULED: "scheduled",
  ON_DEMAND: "on_demand",
} as const;

export const recordKindSchema = z.enum([
  RECORD_KIND.SCHEDULED,
  RECORD_KIND.ON_DEMAND,
]);

export type RecordKind = z.infer<typeof recordKindSchema>;

export const RECORD_DISPLAY_STATE = {
  SUBMITTED: "submitted",
  MISSED: "missed",
  VOIDED: "voided",
  OPEN: "open",
} as const;

export const recordDisplayStateSchema = z.enum([
  RECORD_DISPLAY_STATE.SUBMITTED,
  RECORD_DISPLAY_STATE.MISSED,
  RECORD_DISPLAY_STATE.VOIDED,
  RECORD_DISPLAY_STATE.OPEN,
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
  NO_DEADLINE: "no_deadline",
} as const;

export const recordTimingSchema = z.enum([
  RECORD_TIMING.NOT_SUBMITTED,
  RECORD_TIMING.ON_TIME,
  RECORD_TIMING.LATE,
  RECORD_TIMING.NO_DEADLINE,
]);

export type RecordTiming = z.infer<typeof recordTimingSchema>;

export function isRealCalendarDate(value: string): boolean {
  return isCalendarDate(value) && addCalendarDays(value, 0) === value;
}

export const recordsCalendarDateSchema = z
  .string()
  .refine(isRealCalendarDate, { error: "Date must be a real YYYY-MM-DD date" });

export const RECORDS_SORT_FIELDS = ["entryAt", "title"] as const;

export type RecordsSortField = (typeof RECORDS_SORT_FIELDS)[number];

export const RECORDS_DEFAULT_SORT = {
  sortBy: "entryAt",
  sortOrder: SORT_ORDER.ASC,
} as const;

export const RECORDS_CATEGORY_FILTER_VALUES = FORM_CATEGORY_VALUES;

export const RECORDS_STATE_FILTER_VALUES = [
  RECORD_DISPLAY_STATE.SUBMITTED,
  RECORD_DISPLAY_STATE.MISSED,
  RECORD_DISPLAY_STATE.VOIDED,
  RECORD_DISPLAY_STATE.OPEN,
] as const;

export const RECORDS_RESULT_FILTER_VALUES = [
  RECORD_RESULT.PASS,
  RECORD_RESULT.FAIL,
  RECORD_RESULT.NOT_EVALUATED,
] as const;

/** One word per row, the state and the result together: what the Status filter offers. */
export const RECORD_OUTCOME = {
  PASSED: "passed",
  ATTENTION: "attention",
  RECORDED: "recorded",
  MISSED: "missed",
  VOIDED: "voided",
  OPEN: "open",
} as const;

export const RECORDS_OUTCOME_FILTER_VALUES = [
  RECORD_OUTCOME.PASSED,
  RECORD_OUTCOME.ATTENTION,
  RECORD_OUTCOME.RECORDED,
  RECORD_OUTCOME.MISSED,
  RECORD_OUTCOME.VOIDED,
  RECORD_OUTCOME.OPEN,
] as const;

export type RecordOutcome = (typeof RECORDS_OUTCOME_FILTER_VALUES)[number];

/** Only lateness is filterable: the other timings already follow from the state filter. */
export const RECORDS_TIMING_FILTER_VALUES = [RECORD_TIMING.LATE] as const;

/** A crafted query string can carry any number of ids; a menu never offers this many. */
export const RECORDS_ID_FILTER_MAX = 100;

/** Check, item and person filters: ids, so their options come from the location's own data. */
const recordsIdFilters = {
  form: createGridIdFilterSchema(RECORDS_ID_FILTER_MAX),
  target: createGridIdFilterSchema(RECORDS_ID_FILTER_MAX),
  recordedBy: createGridIdFilterSchema(RECORDS_ID_FILTER_MAX),
};

/** One check's item left out of a printed journal, as `formId:targetId`. */
export type RecordsExcludedItem = { formId: string; targetId: string };

/** Pairs are what let one journal cover only some items while another covers them all. */
export const recordsExcludeFilterSchema = z
  .string()
  .optional()
  .transform((raw) =>
    raw === undefined
      ? []
      : raw
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part !== ""),
  )
  .pipe(
    z
      .array(
        z
          .string()
          .transform((pair) => pair.split(":"))
          .pipe(z.tuple([z.uuid(), z.uuid()]))
          .transform(([formId, targetId]) => ({ formId, targetId })),
      )
      .max(RECORDS_ID_FILTER_MAX),
  )
  .transform((parsed): RecordsExcludedItem[] | undefined => {
    if (parsed.length === 0) return undefined;
    const unique = new Map(
      parsed.map((pair) => [`${pair.formId}:${pair.targetId}`, pair]),
    );
    return [...unique.keys()].sort().map((key) => unique.get(key)!);
  });

/** The wire form `recordsExcludeFilterSchema` parses back to the same canonical list. */
export function serializeRecordsExclude(
  pairs: readonly RecordsExcludedItem[],
): string {
  return [...new Set(pairs.map((pair) => `${pair.formId}:${pair.targetId}`))]
    .sort()
    .join(",");
}

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

function checkDateRangeOrder(
  ctx: z.core.ParsePayload<{
    dateFrom: string;
    dateTo: string;
  }>,
): void {
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
}

/** Searches the check's name and the item's name, as recorded. */
export const recordsListQuerySchema = createGridQuerySchema({
  sortFields: RECORDS_SORT_FIELDS,
  filters: {
    category: createGridFilterSchema(RECORDS_CATEGORY_FILTER_VALUES),
    state: createGridFilterSchema(RECORDS_STATE_FILTER_VALUES),
    result: createGridFilterSchema(RECORDS_RESULT_FILTER_VALUES),
    timing: createGridFilterSchema(RECORDS_TIMING_FILTER_VALUES),
    outcome: createGridFilterSchema(RECORDS_OUTCOME_FILTER_VALUES),
    ...recordsIdFilters,
  },
})
  .safeExtend({
    dateFrom: recordsCalendarDateSchema,
    dateTo: recordsCalendarDateSchema,
  })
  .check(checkDateRangeOrder);

export type RecordsListQuery = z.infer<typeof recordsListQuerySchema>;

/**
 * Browser printing must render the complete result, so the report is guarded by rows,
 * not by date span. This is an operational rendering limit — a later measured renderer
 * can raise it deliberately; it is not a retention or audit-period rule.
 */
export const RECORDS_PRINT_MAX_ROWS = 5000;

export const RECORDS_REPORT_STATUS = {
  OK: "ok",
  TOO_LARGE: "too_large",
} as const;

export type RecordsReportStatus =
  (typeof RECORDS_REPORT_STATUS)[keyof typeof RECORDS_REPORT_STATUS];

/** strictObject is what rejects page/pageSize/sort: the report always covers the whole dataset. */
const recordsReportBaseSchema = z.strictObject({
  dateFrom: recordsCalendarDateSchema,
  dateTo: recordsCalendarDateSchema,
  category: createGridFilterSchema(RECORDS_CATEGORY_FILTER_VALUES),
  state: createGridFilterSchema(RECORDS_STATE_FILTER_VALUES),
  result: createGridFilterSchema(RECORDS_RESULT_FILTER_VALUES),
  timing: createGridFilterSchema(RECORDS_TIMING_FILTER_VALUES),
  exclude: recordsExcludeFilterSchema,
  ...recordsIdFilters,
});

export const recordsReportQuerySchema =
  recordsReportBaseSchema.check(checkDateRangeOrder);

export type RecordsReportQuery = z.infer<typeof recordsReportQuerySchema>;

/** Journals and deviations are the same snapshot as the list, laid out differently by the print page. */
export const RECORDS_REPORT_LAYOUT = {
  LIST: "list",
  JOURNALS: "journals",
  DEVIATIONS: "deviations",
} as const;

export const recordsReportLayoutSchema = z.enum([
  RECORDS_REPORT_LAYOUT.LIST,
  RECORDS_REPORT_LAYOUT.JOURNALS,
  RECORDS_REPORT_LAYOUT.DEVIATIONS,
]);

export type RecordsReportLayout = z.infer<typeof recordsReportLayoutSchema>;

/** The print page carries locationId and layout in the URL; the API takes neither as a query parameter. */
export const recordsReportSearchParamsSchema = recordsReportBaseSchema
  .safeExtend({
    locationId: z.uuid(),
    layout: recordsReportLayoutSchema.default(RECORDS_REPORT_LAYOUT.LIST),
    /** Ends a journal pack with the deviations report, from the same rows. */
    deviations: z.literal("include").optional(),
  })
  .check(checkDateRangeOrder);

export type RecordsReportSearchParams = z.infer<
  typeof recordsReportSearchParamsSchema
>;

export const recordDetailSchema = z.object({
  recordId: z.uuid(),
  createdAt: z.iso.datetime(),
  createdBy: userSummarySchema.nullable(),
  recordedAt: z.iso.datetime(),
  recordedBy: userSummarySchema.nullable(),
  voidedAt: z.iso.datetime().nullable(),
  voidedBy: userSummarySchema.nullable(),
  values: recordValuesSchema,
  correctiveAction: z.string().nullable(),
});

export type RecordDetail = z.infer<typeof recordDetailSchema>;

/** One Records row: a record (scheduled or on-demand), or a scheduled check that has none. */
export const recordItemSchema = z.object({
  /** The record id when there is a record, else the occurrence id. */
  id: z.uuid(),
  kind: recordKindSchema,
  occurrenceId: z.uuid().nullable(),
  taskTemplateId: z.uuid().nullable(),
  entryDate: recordsCalendarDateSchema,
  entryTime: scheduledTimeSchema,
  availableAt: z.iso.datetime().nullable(),
  dueAt: z.iso.datetime().nullable(),
  title: z.string(),
  formVersionId: z.uuid(),
  category: formCategorySchema,
  targetId: z.uuid().nullable(),
  targetName: z.string().nullable(),
  resolvedLimits: resolvedLimitsSchema,
  displayState: recordDisplayStateSchema,
  recordState: recordEntryStateSchema,
  timing: recordTimingSchema,
  result: recordResultSchema,
  record: recordDetailSchema.nullable(),
});

export type RecordItem = z.infer<typeof recordItemSchema>;

export const recordsListResponseSchema = createGridPageSchema(
  recordItemSchema,
).extend({
  formVersions: formVersionSummaryMapSchema,
});

export type RecordsListResponse = z.infer<typeof recordsListResponseSchema>;

/**
 * Over-limit is an expected answer, not a failed request, so it rides on a 200 — the
 * error envelope carries no structured payload and could not report the count.
 */
export const recordsReportResponseSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal(RECORDS_REPORT_STATUS.OK),
    generatedAt: z.iso.datetime(),
    total: z.int().nonnegative(),
    items: z.array(recordItemSchema),
    formVersions: formVersionSummaryMapSchema,
  }),
  z.strictObject({
    status: z.literal(RECORDS_REPORT_STATUS.TOO_LARGE),
    generatedAt: z.iso.datetime(),
    total: z.int().nonnegative(),
    limit: z.int().positive(),
  }),
]);

export type RecordsReportResponse = z.infer<typeof recordsReportResponseSchema>;

export type RecordsReportOk = Extract<
  RecordsReportResponse,
  { status: typeof RECORDS_REPORT_STATUS.OK }
>;

export type RecordsReportTooLarge = Extract<
  RecordsReportResponse,
  { status: typeof RECORDS_REPORT_STATUS.TOO_LARGE }
>;

export type RecordEligibilityInput = {
  hasRecord: boolean;
  availableAt: Date;
  dueAt: Date | null;
  now: Date;
};

/**
 * Records holds audit evidence: submitted or voided immediately; otherwise a finite deadline
 * makes the row eligible once due, and a no-deadline occurrence becomes eligible once opened
 * so the admin can see it remains outstanding without being called missed.
 */
export function isRecordEligible(input: RecordEligibilityInput): boolean {
  if (input.hasRecord) return true;

  return input.dueAt !== null
    ? input.dueAt.getTime() <= input.now.getTime()
    : input.availableAt.getTime() <= input.now.getTime();
}

export function deriveRecordEntryState(
  record: { voidedAt: Date | null } | null,
): RecordEntryState {
  if (!record) return RECORD_ENTRY_STATE.NONE;
  return record.voidedAt === null
    ? RECORD_ENTRY_STATE.SUBMITTED
    : RECORD_ENTRY_STATE.VOIDED;
}

/** No record and a null dueAt is Open, not Missed — it only appears here once opened (see isRecordEligible). */
export function deriveRecordDisplayState(input: {
  record: { voidedAt: Date | null } | null;
  dueAt: Date | null;
}): RecordDisplayState {
  const { record, dueAt } = input;

  if (record) {
    return record.voidedAt === null
      ? RECORD_DISPLAY_STATE.SUBMITTED
      : RECORD_DISPLAY_STATE.VOIDED;
  }

  return dueAt === null
    ? RECORD_DISPLAY_STATE.OPEN
    : RECORD_DISPLAY_STATE.MISSED;
}

/** A voided record has no active submission, so it carries no timing claim; a submitted no-deadline record is No deadline, not Late. */
export function deriveRecordTiming(input: {
  record: { recordedAt: Date; voidedAt: Date | null } | null;
  dueAt: Date | null;
}): RecordTiming {
  const { record, dueAt } = input;

  if (!record || record.voidedAt !== null) {
    return RECORD_TIMING.NOT_SUBMITTED;
  }

  if (dueAt === null) {
    return RECORD_TIMING.NO_DEADLINE;
  }

  return record.recordedAt.getTime() <= dueAt.getTime()
    ? RECORD_TIMING.ON_TIME
    : RECORD_TIMING.LATE;
}

/** A voided record keeps the result it was judged with; an occurrence without a record was never evaluated. */
export function deriveRecordResult(
  record: { result: RecordResult } | null,
): RecordResult {
  return record?.result ?? RECORD_RESULT.NOT_EVALUATED;
}

/** An option a Records filter offers; archived ones stay listed because old records still point at them. */
export const recordsFilterOptionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  archived: z.boolean(),
});

export type RecordsFilterOption = z.infer<typeof recordsFilterOptionSchema>;

/** The checks with rows at this location, its items, and everyone who has recorded there. */
export const recordsFilterOptionsResponseSchema = z.object({
  forms: z.array(recordsFilterOptionSchema),
  targets: z.array(recordsFilterOptionSchema),
  people: z.array(userSummarySchema),
});

export type RecordsFilterOptionsResponse = z.infer<
  typeof recordsFilterOptionsResponseSchema
>;

/** One item's rows inside a journal; the area is named so a phone can group components under it. */
export const recordsJournalTargetSchema = z.object({
  targetId: z.uuid(),
  name: z.string(),
  kind: targetKindSchema,
  areaName: z.string().nullable(),
  total: z.int().positive(),
});

export type RecordsJournalTarget = z.infer<typeof recordsJournalTargetSchema>;

/** How many Records rows one check has under a query: what the print dialog offers as a journal. */
export const recordsJournalSummarySchema = z.object({
  formId: z.uuid(),
  name: z.string(),
  /** Every row, the ones with no item included. */
  total: z.int().positive(),
  /** Empty for a check of the whole location: there is nothing to choose. */
  targets: z.array(recordsJournalTargetSchema),
});

export type RecordsJournalSummary = z.infer<typeof recordsJournalSummarySchema>;

export const recordsJournalsResponseSchema = z.object({
  items: z.array(recordsJournalSummarySchema),
});

export type RecordsJournalsResponse = z.infer<
  typeof recordsJournalsResponseSchema
>;
