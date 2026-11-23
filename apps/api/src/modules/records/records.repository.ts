import {
  RECORD_DISPLAY_STATE,
  RECORD_RESULT,
  type RecordDisplayState,
  type RecordResult,
  type RecordValues,
  type RecordsSortField,
  type ResolvedLimits,
  type SortOrder,
} from "@haccp/shared";
import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  notExists,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias, unionAll, type AnyPgColumn } from "drizzle-orm/pg-core";
import type { DbClient } from "../../core/db/client.js";
import { formVersions } from "../../core/db/schema/form-versions.js";
import { forms } from "../../core/db/schema/forms.js";
import { locations } from "../../core/db/schema/locations.js";
import { taskOccurrences } from "../../core/db/schema/task-occurrences.js";
import { taskRecords } from "../../core/db/schema/task-records.js";
import { users } from "../../core/db/schema/users.js";

const createdByUser = alias(users, "records_created_by");
const recordedByUser = alias(users, "records_recorded_by");
const voidedByUser = alias(users, "records_voided_by");

export type RecordsScope = {
  locationId: string;
  organizationId: string;
  dateFrom: string;
  dateTo: string;
  now: Date;
};

export type RecordsFilters = {
  category?: string[];
  state?: RecordDisplayState[];
  result?: RecordResult[];
};

export type RecordsPageParams = RecordsScope & {
  filters: RecordsFilters;
  sortBy: RecordsSortField;
  sortOrder: SortOrder;
  limit: number;
  offset: number;
};

export type RecordRow = {
  /** The record id when there is a record, else the occurrence id. */
  rowId: string;
  occurrenceId: string | null;
  taskTemplateId: string | null;
  entryDate: string;
  entryTime: string;
  availableAt: Date | null;
  dueAt: Date | null;
  title: string;
  formVersionId: string;
  category: string;
  targetId: string | null;
  targetName: string | null;
  resolvedLimits: ResolvedLimits;
  recordId: string | null;
  recordCreatedAt: Date | null;
  recordedAt: Date | null;
  voidedAt: Date | null;
  createdById: string | null;
  createdByFirstName: string | null;
  createdByLastName: string | null;
  recordedById: string | null;
  recordedByFirstName: string | null;
  recordedByLastName: string | null;
  voidedById: string | null;
  voidedByFirstName: string | null;
  voidedByLastName: string | null;
  recordResult: string | null;
  values: RecordValues | null;
  correctiveAction: string | null;
};

/** Output names both branches share, so the union can be ordered by them. */
const COLUMN = {
  rowId: "row_id",
  entryDate: "row_entry_date",
  entryTime: "row_entry_time",
  title: "row_title",
} as const;

/** Rows that are records: every record in range is audit evidence, whether or not it fulfils an occurrence. */
function recordScopeCondition(scope: RecordsScope): SQL {
  return and(
    eq(taskRecords.locationId, scope.locationId),
    eq(locations.organizationId, scope.organizationId),
    gte(taskRecords.entryDate, scope.dateFrom),
    lte(taskRecords.entryDate, scope.dateTo),
  )!;
}

/**
 * Rows that are occurrences with no record: a finite deadline makes one eligible once due,
 * and a no-deadline one once opened, so unrecorded work still ahead stays operational.
 */
function occurrenceScopeCondition(scope: RecordsScope): SQL {
  return and(
    eq(taskOccurrences.locationId, scope.locationId),
    eq(locations.organizationId, scope.organizationId),
    gte(taskOccurrences.occurrenceDate, scope.dateFrom),
    lte(taskOccurrences.occurrenceDate, scope.dateTo),
    notExists(
      sql`(select 1 from ${taskRecords} where ${taskRecords.occurrenceId} = ${taskOccurrences.id})`,
    ),
    or(
      and(
        isNotNull(taskOccurrences.dueAt),
        lte(taskOccurrences.dueAt, scope.now),
      ),
      and(
        isNull(taskOccurrences.dueAt),
        lte(taskOccurrences.availableAt, scope.now),
      ),
    ),
  )!;
}

/** A filter either narrows a branch, leaves it whole (undefined), or rules it out entirely (null). */
type BranchFilter = SQL | undefined | null;

function recordStateFilter(states: RecordDisplayState[]): BranchFilter {
  const conditions = states.flatMap((state) => {
    if (state === RECORD_DISPLAY_STATE.SUBMITTED) {
      return [isNull(taskRecords.voidedAt)];
    }
    if (state === RECORD_DISPLAY_STATE.VOIDED) {
      return [isNotNull(taskRecords.voidedAt)];
    }
    return [];
  });
  return conditions.length === 0 ? null : or(...conditions)!;
}

function occurrenceStateFilter(states: RecordDisplayState[]): BranchFilter {
  const conditions = states.flatMap((state) => {
    if (state === RECORD_DISPLAY_STATE.MISSED) {
      return [isNotNull(taskOccurrences.dueAt)];
    }
    if (state === RECORD_DISPLAY_STATE.OPEN) {
      return [isNull(taskOccurrences.dueAt)];
    }
    return [];
  });
  return conditions.length === 0 ? null : or(...conditions)!;
}

function recordResultFilter(results: RecordResult[]): BranchFilter {
  return inArray(taskRecords.result, results);
}

/** An occurrence without a record was never evaluated. */
function occurrenceResultFilter(results: RecordResult[]): BranchFilter {
  return results.includes(RECORD_RESULT.NOT_EVALUATED) ? undefined : null;
}

function combineFilters(
  scope: SQL,
  filters: RecordsFilters,
  stateFilter: (states: RecordDisplayState[]) => BranchFilter,
  resultFilter: (results: RecordResult[]) => BranchFilter,
): SQL | null {
  const conditions: SQL[] = [scope];

  if (filters.category && filters.category.length > 0) {
    conditions.push(inArray(forms.category, filters.category));
  }

  const narrowed = [
    filters.state && filters.state.length > 0
      ? stateFilter(filters.state)
      : undefined,
    filters.result && filters.result.length > 0
      ? resultFilter(filters.result)
      : undefined,
  ];

  for (const condition of narrowed) {
    if (condition === null) return null;
    if (condition !== undefined) conditions.push(condition);
  }

  return and(...conditions)!;
}

function recordBranchCondition(params: {
  scope: RecordsScope;
  filters: RecordsFilters;
}): SQL | null {
  return combineFilters(
    recordScopeCondition(params.scope),
    params.filters,
    recordStateFilter,
    recordResultFilter,
  );
}

function occurrenceBranchCondition(params: {
  scope: RecordsScope;
  filters: RecordsFilters;
}): SQL | null {
  return combineFilters(
    occurrenceScopeCondition(params.scope),
    params.filters,
    occurrenceStateFilter,
    occurrenceResultFilter,
  );
}

function column(name: string): SQL {
  return sql.identifier(name) as unknown as SQL;
}

/** Every ordering ends in the row id, or limit/offset paging can repeat and drop rows. */
function orderByTerms(sortBy: RecordsSortField, sortOrder: SortOrder): SQL[] {
  const direction = sortOrder === "desc" ? sql`desc` : sql`asc`;
  const asc = sql`asc`;

  const terms: [string, SQL][] =
    sortBy === "title"
      ? [
          [COLUMN.title, direction],
          [COLUMN.entryDate, asc],
          [COLUMN.entryTime, asc],
          [COLUMN.rowId, asc],
        ]
      : [
          [COLUMN.entryDate, direction],
          [COLUMN.entryTime, direction],
          [COLUMN.rowId, asc],
        ];

  return terms.map(([name, dir]) => sql`${column(name)} ${dir}`);
}

function nullableTimestamp(column: AnyPgColumn): SQL<Date | null> {
  return sql`${column}`.mapWith(column) as SQL<Date | null>;
}

/** Record fields are widened to nullable so the union with unrecorded occurrences type-checks. */
function selectRecords(db: DbClient, where: SQL) {
  return db
    .select({
      rowId: sql<string>`${taskRecords.id}`.as(COLUMN.rowId),
      occurrenceId: taskRecords.occurrenceId,
      taskTemplateId: taskRecords.taskTemplateId,
      entryDate: sql<string>`${taskRecords.entryDate}`.as(COLUMN.entryDate),
      entryTime: sql<string>`${taskRecords.entryTime}`.as(COLUMN.entryTime),
      availableAt: taskOccurrences.availableAt,
      dueAt: taskOccurrences.dueAt,
      title: sql<string>`${taskRecords.title}`.as(COLUMN.title),
      formVersionId: taskRecords.formVersionId,
      category: forms.category,
      targetId: taskRecords.targetId,
      targetName: taskRecords.targetName,
      resolvedLimits: taskRecords.resolvedLimits,
      recordId: sql<string | null>`${taskRecords.id}`,
      recordCreatedAt: nullableTimestamp(taskRecords.createdAt),
      recordedAt: nullableTimestamp(taskRecords.recordedAt),
      voidedAt: taskRecords.voidedAt,
      createdById: createdByUser.id,
      createdByFirstName: createdByUser.firstName,
      createdByLastName: createdByUser.lastName,
      recordedById: recordedByUser.id,
      recordedByFirstName: recordedByUser.firstName,
      recordedByLastName: recordedByUser.lastName,
      voidedById: voidedByUser.id,
      voidedByFirstName: voidedByUser.firstName,
      voidedByLastName: voidedByUser.lastName,
      recordResult: sql<string | null>`${taskRecords.result}`,
      values: sql`${taskRecords.values}`.mapWith(
        taskRecords.values,
      ) as SQL<RecordValues | null>,
      correctiveAction: taskRecords.correctiveAction,
    })
    .from(taskRecords)
    .innerJoin(locations, eq(locations.id, taskRecords.locationId))
    .leftJoin(taskOccurrences, eq(taskOccurrences.id, taskRecords.occurrenceId))
    .innerJoin(formVersions, eq(formVersions.id, taskRecords.formVersionId))
    .innerJoin(forms, eq(forms.id, formVersions.formId))
    .leftJoin(createdByUser, eq(createdByUser.id, taskRecords.createdByUserId))
    .leftJoin(
      recordedByUser,
      eq(recordedByUser.id, taskRecords.recordedByUserId),
    )
    .leftJoin(voidedByUser, eq(voidedByUser.id, taskRecords.voidedByUserId))
    .where(where);
}

/** Column for column with `selectRecords`; the record half is typed NULLs. */
function selectUnrecordedOccurrences(db: DbClient, where: SQL) {
  return db
    .select({
      rowId: sql<string>`${taskOccurrences.id}`.as(COLUMN.rowId),
      occurrenceId: sql<string | null>`${taskOccurrences.id}`,
      taskTemplateId: taskOccurrences.taskTemplateId,
      entryDate: sql<string>`${taskOccurrences.occurrenceDate}`.as(
        COLUMN.entryDate,
      ),
      entryTime: sql<string>`${taskOccurrences.scheduledTime}`.as(
        COLUMN.entryTime,
      ),
      availableAt: nullableTimestamp(taskOccurrences.availableAt),
      dueAt: taskOccurrences.dueAt,
      title: sql<string>`${taskOccurrences.title}`.as(COLUMN.title),
      formVersionId: taskOccurrences.formVersionId,
      category: forms.category,
      targetId: taskOccurrences.targetId,
      targetName: taskOccurrences.targetName,
      resolvedLimits: taskOccurrences.resolvedLimits,
      recordId: sql<string | null>`null::uuid`,
      recordCreatedAt: sql<Date | null>`null::timestamptz`,
      recordedAt: sql<Date | null>`null::timestamptz`,
      voidedAt: sql<Date | null>`null::timestamptz`,
      createdById: sql<string | null>`null::uuid`,
      createdByFirstName: sql<string | null>`null::text`,
      createdByLastName: sql<string | null>`null::text`,
      recordedById: sql<string | null>`null::uuid`,
      recordedByFirstName: sql<string | null>`null::text`,
      recordedByLastName: sql<string | null>`null::text`,
      voidedById: sql<string | null>`null::uuid`,
      voidedByFirstName: sql<string | null>`null::text`,
      voidedByLastName: sql<string | null>`null::text`,
      recordResult: sql<string | null>`null::text`,
      values: sql<RecordValues | null>`null::jsonb`,
      correctiveAction: sql<string | null>`null::text`,
    })
    .from(taskOccurrences)
    .innerJoin(locations, eq(locations.id, taskOccurrences.locationId))
    .innerJoin(
      formVersions,
      eq(formVersions.id, taskOccurrences.formVersionId),
    )
    .innerJoin(forms, eq(forms.id, formVersions.formId))
    .where(where);
}

async function countRecords(db: DbClient, where: SQL): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(taskRecords)
    .innerJoin(locations, eq(locations.id, taskRecords.locationId))
    .innerJoin(formVersions, eq(formVersions.id, taskRecords.formVersionId))
    .innerJoin(forms, eq(forms.id, formVersions.formId))
    .where(where);

  return row?.total ?? 0;
}

async function countUnrecordedOccurrences(
  db: DbClient,
  where: SQL,
): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(taskOccurrences)
    .innerJoin(locations, eq(locations.id, taskOccurrences.locationId))
    .innerJoin(
      formVersions,
      eq(formVersions.id, taskOccurrences.formVersionId),
    )
    .innerJoin(forms, eq(forms.id, formVersions.formId))
    .where(where);

  return row?.total ?? 0;
}

export const recordsRepository = {
  async findPage(
    db: DbClient,
    params: RecordsPageParams,
  ): Promise<RecordRow[]> {
    const recordWhere = recordBranchCondition({ scope: params, ...params });
    const occurrenceWhere = occurrenceBranchCondition({
      scope: params,
      ...params,
    });
    const order = orderByTerms(params.sortBy, params.sortOrder);

    // Drizzle set operations mutate their first branch, so each query builds fresh ones.
    if (recordWhere && occurrenceWhere) {
      return unionAll(
        selectRecords(db, recordWhere),
        selectUnrecordedOccurrences(db, occurrenceWhere),
      )
        .orderBy(...order)
        .limit(params.limit)
        .offset(params.offset);
    }

    if (recordWhere) {
      return selectRecords(db, recordWhere)
        .orderBy(...order)
        .limit(params.limit)
        .offset(params.offset);
    }

    if (occurrenceWhere) {
      return selectUnrecordedOccurrences(db, occurrenceWhere)
        .orderBy(...order)
        .limit(params.limit)
        .offset(params.offset);
    }

    return [];
  },

  async countPage(
    db: DbClient,
    params: RecordsScope & { filters: RecordsFilters },
  ): Promise<number> {
    const recordWhere = recordBranchCondition({ scope: params, ...params });
    const occurrenceWhere = occurrenceBranchCondition({
      scope: params,
      ...params,
    });

    const [records, occurrences] = await Promise.all([
      recordWhere ? countRecords(db, recordWhere) : 0,
      occurrenceWhere ? countUnrecordedOccurrences(db, occurrenceWhere) : 0,
    ]);

    return records + occurrences;
  },
};

export const recordsQueryInternals = {
  occurrenceBranchCondition,
  orderByTerms,
  recordBranchCondition,
};
