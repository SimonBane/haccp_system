import {
  GRID_DEFAULT_PAGE_SIZE,
  RECORDS_DATE_RANGE_ERROR,
  RECORDS_DEFAULT_SORT,
  RECORDS_PRINT_MAX_ROWS,
  RECORDS_REPORT_STATUS,
  isValidTimeZone,
  validateRecordsDateRange,
  zonedDateString,
  type RecordsListQuery,
  type RecordsListResponse,
  type RecordsReportQuery,
  type RecordsReportResponse,
  type RecordsSortField,
  type SortOrder,
} from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import {
  InternalError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { toRecordItem } from "./records.mapper.js";
import {
  recordsRepository,
  type RecordRow,
  type RecordsFilters,
  type RecordsScope,
} from "./records.repository.js";

export type NormalizedRecordsQuery = {
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
  sortBy: RecordsSortField;
  sortOrder: SortOrder;
  filters: RecordsFilters;
};

export function normalizeRecordsQuery(
  query: RecordsListQuery,
): NormalizedRecordsQuery {
  return {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? GRID_DEFAULT_PAGE_SIZE,
    sortBy: query.sortBy ?? RECORDS_DEFAULT_SORT.sortBy,
    sortOrder: query.sortOrder ?? RECORDS_DEFAULT_SORT.sortOrder,
    filters: {
      type: query.type,
      state: query.state,
      result: query.result,
    },
  };
}

export type NormalizedRecordsReportQuery = {
  dateFrom: string;
  dateTo: string;
  sortBy: RecordsSortField;
  sortOrder: SortOrder;
  offset: number;
  filters: RecordsFilters;
};

/**
 * The report is the whole dataset in canonical chronological order, so paging and the
 * interactive grid sort are fixed here rather than accepted from the caller.
 */
export function normalizeRecordsReportQuery(
  query: RecordsReportQuery,
): NormalizedRecordsReportQuery {
  return {
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    sortBy: RECORDS_DEFAULT_SORT.sortBy,
    sortOrder: RECORDS_DEFAULT_SORT.sortOrder,
    offset: 0,
    filters: {
      type: query.type,
      state: query.state,
      result: query.result,
    },
  };
}

const RANGE_ERROR_MESSAGE = {
  [RECORDS_DATE_RANGE_ERROR.INVALID]:
    "dateFrom and dateTo must be calendar dates",
  [RECORDS_DATE_RANGE_ERROR.ORDER]: "dateFrom must be on or before dateTo",
  [RECORDS_DATE_RANGE_ERROR.FUTURE]:
    "dateTo must not be later than the organization's current date",
} as const;

type RecordsRequestParams = {
  locationId: string;
  organizationId: string;
  timeZone: string;
};

/** `now` is captured once here so eligibility, the count and the read all agree. */
function resolveScope(
  params: RecordsRequestParams,
  range: { dateFrom: string; dateTo: string },
): RecordsScope {
  if (!isValidTimeZone(params.timeZone)) {
    throw new InternalError("Organization timezone configuration is invalid");
  }

  const now = new Date();

  const rangeError = validateRecordsDateRange({
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    today: zonedDateString(now, params.timeZone),
  });

  if (rangeError) {
    throw new ValidationError(RANGE_ERROR_MESSAGE[rangeError]);
  }

  return {
    locationId: params.locationId,
    organizationId: params.organizationId,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    now,
  };
}

function assertCompleteReport(rows: RecordRow[], total: number): void {
  if (rows.length !== total) {
    throw new InternalError(
      "Report row count did not match the snapshot total",
    );
  }

  if (new Set(rows.map((row) => row.occurrenceId)).size !== rows.length) {
    throw new InternalError("Report contained a duplicate occurrence");
  }
}

export const recordsService = {
  async listRecords(
    db: Db,
    params: RecordsRequestParams & { query: RecordsListQuery },
  ): Promise<RecordsListResponse> {
    const normalized = normalizeRecordsQuery(params.query);
    const scope = resolveScope(params, normalized);

    const [rows, total] = await Promise.all([
      recordsRepository.findPage(db, {
        ...scope,
        filters: normalized.filters,
        sortBy: normalized.sortBy,
        sortOrder: normalized.sortOrder,
        limit: normalized.pageSize,
        offset: (normalized.page - 1) * normalized.pageSize,
      }),
      recordsRepository.countPage(db, {
        ...scope,
        filters: normalized.filters,
      }),
    ]);

    return {
      items: rows.map(toRecordItem),
      total,
    };
  },

  /**
   * Repeatable read is what makes the count/read equality assert a bug detector: `now` is a
   * bind parameter, but a concurrent insert can still flip an occurrence from missed to
   * submitted between the two queries and move it across a `state` filter. On Vercel the
   * pool holds a single connection, so this transaction owns it for the whole report.
   */
  async getRecordsReport(
    db: Db,
    params: RecordsRequestParams & { query: RecordsReportQuery },
  ): Promise<RecordsReportResponse> {
    const normalized = normalizeRecordsReportQuery(params.query);
    const scope = resolveScope(params, normalized);
    const generatedAt = scope.now.toISOString();

    return db.transaction(
      async (tx) => {
        const total = await recordsRepository.countPage(tx, {
          ...scope,
          filters: normalized.filters,
        });

        if (total > RECORDS_PRINT_MAX_ROWS) {
          return {
            status: RECORDS_REPORT_STATUS.TOO_LARGE,
            generatedAt,
            total,
            limit: RECORDS_PRINT_MAX_ROWS,
          };
        }

        const rows = await recordsRepository.findPage(tx, {
          ...scope,
          filters: normalized.filters,
          sortBy: normalized.sortBy,
          sortOrder: normalized.sortOrder,
          limit: RECORDS_PRINT_MAX_ROWS + 1,
          offset: normalized.offset,
        });

        assertCompleteReport(rows, total);

        return {
          status: RECORDS_REPORT_STATUS.OK,
          generatedAt,
          total,
          items: rows.map(toRecordItem),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  },
};
