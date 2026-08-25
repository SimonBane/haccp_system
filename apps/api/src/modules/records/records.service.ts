import {
  GRID_DEFAULT_PAGE_SIZE,
  RECORDS_DATE_RANGE_ERROR,
  RECORDS_DEFAULT_SORT,
  isValidTimeZone,
  validateRecordsDateRange,
  zonedDateString,
  type RecordsListQuery,
  type RecordsListResponse,
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
  type RecordsFilters,
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

const RANGE_ERROR_MESSAGE = {
  [RECORDS_DATE_RANGE_ERROR.INVALID]:
    "dateFrom and dateTo must be calendar dates",
  [RECORDS_DATE_RANGE_ERROR.ORDER]: "dateFrom must be on or before dateTo",
  [RECORDS_DATE_RANGE_ERROR.FUTURE]:
    "dateTo must not be later than the organization's current date",
} as const;

export const recordsService = {
  async listRecords(
    db: Db,
    params: {
      locationId: string;
      organizationId: string;
      timeZone: string;
      query: RecordsListQuery;
    },
  ): Promise<RecordsListResponse> {
    if (!isValidTimeZone(params.timeZone)) {
      throw new InternalError("Organization timezone configuration is invalid");
    }

    const now = new Date();
    const normalized = normalizeRecordsQuery(params.query);

    const rangeError = validateRecordsDateRange({
      dateFrom: normalized.dateFrom,
      dateTo: normalized.dateTo,
      today: zonedDateString(now, params.timeZone),
    });

    if (rangeError) {
      throw new ValidationError(RANGE_ERROR_MESSAGE[rangeError]);
    }

    const scope = {
      locationId: params.locationId,
      organizationId: params.organizationId,
      dateFrom: normalized.dateFrom,
      dateTo: normalized.dateTo,
      now,
    };

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
};
