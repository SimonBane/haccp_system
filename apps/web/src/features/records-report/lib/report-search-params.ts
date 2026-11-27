import {
  RECORD_DISPLAY_STATE,
  RECORD_RESULT,
  RECORDS_REPORT_LAYOUT,
  recordsReportSearchParamsSchema,
  serializeRecordsExclude,
  validateRecordsDateRange,
  type RecordsReportSearchParams,
} from "@haccp/shared";

export const REPORT_PARAM_ERROR = {
  MALFORMED: "malformed",
  UNKNOWN_LOCATION: "unknownLocation",
  FUTURE_RANGE: "futureRange",
} as const;

export type ReportParamError =
  (typeof REPORT_PARAM_ERROR)[keyof typeof REPORT_PARAM_ERROR];

export type ReportParamsResult =
  | { ok: true; params: RecordsReportSearchParams }
  | { ok: false; error: ReportParamError };

/**
 * A crafted URL is the only way into this page, so every rejection is a typed outcome the
 * page renders — never a throw into the error boundary. `today` must be organization-local.
 */
export function parseReportSearchParams(input: {
  searchParams: Record<string, string | string[] | undefined>;
  locationIds: readonly string[];
  today: string;
}): ReportParamsResult {
  const parsed = recordsReportSearchParamsSchema.safeParse(input.searchParams);

  if (!parsed.success) {
    return { ok: false, error: REPORT_PARAM_ERROR.MALFORMED };
  }

  if (!input.locationIds.includes(parsed.data.locationId)) {
    return { ok: false, error: REPORT_PARAM_ERROR.UNKNOWN_LOCATION };
  }

  if (
    validateRecordsDateRange({
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
      today: input.today,
    })
  ) {
    return { ok: false, error: REPORT_PARAM_ERROR.FUTURE_RANGE };
  }

  return { ok: true, params: parsed.data };
}

/** Canonical like the grid's query; deviations override status and result to failed, non-voided records. */
export function reportApiQuery(params: RecordsReportSearchParams): string {
  const query = new URLSearchParams({
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  });

  const deviations = params.layout === RECORDS_REPORT_LAYOUT.DEVIATIONS;
  const values: Pick<
    RecordsReportSearchParams,
    "category" | "state" | "result" | "timing" | "form" | "target" | "recordedBy"
  > = {
    ...params,
    ...(deviations && {
      state: [RECORD_DISPLAY_STATE.SUBMITTED],
      result: [RECORD_RESULT.FAIL],
    }),
  };

  for (const key of [
    "category",
    "state",
    "result",
    "timing",
    "form",
    "target",
    "recordedBy",
  ] as const) {
    const selected = values[key];
    if (selected && selected.length > 0) {
      query.set(key, selected.join(","));
    }
  }

  if (params.exclude && params.exclude.length > 0) {
    query.set("exclude", serializeRecordsExclude(params.exclude));
  }

  return query.toString();
}
