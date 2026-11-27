import {
  GRID_DEFAULT_PAGE_SIZE,
  RECORDS_DATE_RANGE_ERROR,
  RECORDS_DEFAULT_SORT,
  RECORDS_PRINT_MAX_ROWS,
  RECORDS_REPORT_STATUS,
  isValidTimeZone,
  validateRecordsDateRange,
  zonedDateString,
  type RecordsFilterOptionsResponse,
  type RecordsJournalsResponse,
  type RecordsJournalSummary,
  type RecordsJournalTarget,
  type RecordsListQuery,
  type RecordsListResponse,
  type RecordsReportQuery,
  type RecordsReportResponse,
  type RecordsSortField,
  type SortOrder,
} from "@haccp/shared";
import type { Db, DbClient } from "../../core/db/client.js";
import {
  InternalError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { toFormVersionSummaryMap } from "../forms/form.mapper.js";
import { formRepository } from "../forms/form.repository.js";
import { toRecordItem } from "./records.mapper.js";
import {
  recordsRepository,
  type RecordRow,
  type RecordsFilterOptionRow,
  type RecordsJournalCountRow,
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

/** `exclude` is left out: only the report itself drops items, the journals dialog lists them all. */
function toRecordsFilters(
  query: RecordsListQuery | RecordsReportQuery,
): RecordsFilters {
  return {
    category: query.category,
    state: query.state,
    result: query.result,
    timing: query.timing,
    form: query.form,
    target: query.target,
    recordedBy: query.recordedBy,
  };
}

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
      ...toRecordsFilters(query),
      search: query.search,
      outcome: query.outcome,
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
    filters: { ...toRecordsFilters(query), exclude: query.exclude },
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

  if (new Set(rows.map((row) => row.rowId)).size !== rows.length) {
    throw new InternalError("Report contained a duplicate occurrence");
  }
}

async function formVersionsFor(db: DbClient, rows: RecordRow[]) {
  return toFormVersionSummaryMap(
    await formRepository.findVersionSummariesByIds(db, [
      ...new Set(rows.map((row) => row.formVersionId)),
    ]),
  );
}

function compareJournalTargets(
  a: RecordsJournalTarget,
  b: RecordsJournalTarget,
): number {
  // An area sorts with its own components, ahead of them.
  return (
    (a.areaName ?? a.name).localeCompare(b.areaName ?? b.name) ||
    Number(a.areaName !== null) - Number(b.areaName !== null) ||
    a.name.localeCompare(b.name) ||
    a.targetId.localeCompare(b.targetId)
  );
}

/** Both branches can count the same form and item; summed here so each is offered once. */
export function mergeJournalCounts(
  counts: readonly RecordsJournalCountRow[],
): RecordsJournalSummary[] {
  const byForm = new Map<
    string,
    {
      formId: string;
      name: string;
      total: number;
      targets: Map<string, RecordsJournalTarget>;
    }
  >();

  for (const count of counts) {
    if (count.total <= 0) continue;

    let form = byForm.get(count.formId);
    if (!form) {
      form = {
        formId: count.formId,
        name: count.formName,
        total: 0,
        targets: new Map(),
      };
      byForm.set(count.formId, form);
    }
    form.total += count.total;

    if (count.targetId === null) continue;
    const target = form.targets.get(count.targetId);
    if (target) {
      target.total += count.total;
    } else {
      form.targets.set(count.targetId, {
        targetId: count.targetId,
        name: count.targetName ?? "",
        kind: count.targetKind as RecordsJournalTarget["kind"],
        areaName: count.areaName,
        total: count.total,
      });
    }
  }

  return [...byForm.values()]
    .map((form) => ({
      formId: form.formId,
      name: form.name,
      total: form.total,
      targets: [...form.targets.values()].sort(compareJournalTargets),
    }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name) || a.formId.localeCompare(b.formId),
    );
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
      formVersions: await formVersionsFor(db, rows),
    };
  },

  /** The checks the print dialog offers for a period, under the same filters as the grid. */
  async listJournals(
    db: Db,
    params: RecordsRequestParams & { query: RecordsReportQuery },
  ): Promise<RecordsJournalsResponse> {
    const scope = resolveScope(params, params.query);
    const counts = await recordsRepository.countByFormAndTarget(db, {
      ...scope,
      filters: toRecordsFilters(params.query),
    });

    return { items: mergeJournalCounts(counts) };
  },

  async getFilterOptions(
    db: Db,
    params: { locationId: string; organizationId: string },
  ): Promise<RecordsFilterOptionsResponse> {
    const [formRows, targetRows, people] = await Promise.all([
      recordsRepository.findFormsUsedAtLocation(db, params),
      recordsRepository.findTargetsOfLocation(db, params.locationId),
      recordsRepository.findRecordersAtLocation(db, params.locationId),
    ]);

    const toOption = (row: RecordsFilterOptionRow) => ({
      id: row.id,
      name: row.name,
      archived: row.archivedAt !== null,
    });

    return {
      forms: formRows.map(toOption),
      targets: targetRows
        .map(toOption)
        .sort(
          (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
        ),
      people,
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
          formVersions: await formVersionsFor(tx, rows),
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  },
};
