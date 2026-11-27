import {
  RECORD_DISPLAY_STATE,
  RECORD_OUTCOME,
  RECORD_RESULT,
  RECORD_TIMING,
  type RECORDS_TIMING_FILTER_VALUES,
  type RecordDisplayState,
  type RecordOutcome,
  type RecordResult,
  type RecordValues,
  type RecordsExcludedItem,
  type RecordsSortField,
  type ResolvedLimits,
  type SortOrder,
} from "@haccp/shared";
import {
  and,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  not,
  notExists,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  alias,
  union,
  unionAll,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { DbClient } from "../../core/db/client.js";
import { formVersions } from "../../core/db/schema/form-versions.js";
import { forms } from "../../core/db/schema/forms.js";
import { locations } from "../../core/db/schema/locations.js";
import { targets } from "../../core/db/schema/targets.js";
import { taskOccurrences } from "../../core/db/schema/task-occurrences.js";
import { taskRecords } from "../../core/db/schema/task-records.js";
import { users } from "../../core/db/schema/users.js";
import {
  parentTargets,
  targetLabelColumns,
  withTargetLabel,
} from "../targets/target-label.js";

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

export type RecordsTimingFilter = (typeof RECORDS_TIMING_FILTER_VALUES)[number];

export type RecordsFilters = {
  search?: string;
  category?: string[];
  state?: RecordDisplayState[];
  result?: RecordResult[];
  timing?: RecordsTimingFilter[];
  outcome?: RecordOutcome[];
  form?: string[];
  target?: string[];
  recordedBy?: string[];
  exclude?: RecordsExcludedItem[];
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

/** `dueAt` comes from the left-joined occurrence, so every records query must join it. */
function recordTimingFilter(timings: RecordsTimingFilter[]): BranchFilter {
  return timings.includes(RECORD_TIMING.LATE)
    ? and(
        isNull(taskRecords.voidedAt),
        isNotNull(taskOccurrences.dueAt),
        gt(taskRecords.recordedAt, taskOccurrences.dueAt),
      )!
    : null;
}

/** An unrecorded occurrence has no submission to be late. */
function occurrenceTimingFilter(): BranchFilter {
  return null;
}

const RECORD_OUTCOME_RESULT: Partial<Record<RecordOutcome, RecordResult>> = {
  [RECORD_OUTCOME.PASSED]: RECORD_RESULT.PASS,
  [RECORD_OUTCOME.ATTENTION]: RECORD_RESULT.FAIL,
  [RECORD_OUTCOME.RECORDED]: RECORD_RESULT.NOT_EVALUATED,
};

/** A voided record's result no longer counts, so only live records pass, fail or stand recorded. */
function recordOutcomeFilter(outcomes: RecordOutcome[]): BranchFilter {
  const conditions = outcomes.flatMap((outcome) => {
    if (outcome === RECORD_OUTCOME.VOIDED) {
      return [isNotNull(taskRecords.voidedAt)];
    }
    const result = RECORD_OUTCOME_RESULT[outcome];
    return result === undefined
      ? []
      : [and(isNull(taskRecords.voidedAt), eq(taskRecords.result, result))!];
  });
  return conditions.length === 0 ? null : or(...conditions)!;
}

function occurrenceOutcomeFilter(outcomes: RecordOutcome[]): BranchFilter {
  const conditions = outcomes.flatMap((outcome) => {
    if (outcome === RECORD_OUTCOME.MISSED) {
      return [isNotNull(taskOccurrences.dueAt)];
    }
    if (outcome === RECORD_OUTCOME.OPEN) {
      return [isNull(taskOccurrences.dueAt)];
    }
    return [];
  });
  return conditions.length === 0 ? null : or(...conditions)!;
}

/** Wildcards in the term must match literally, or a search for "100%" would match everything. */
function searchFilter(
  term: string,
  columns: readonly [AnyPgColumn, AnyPgColumn],
): SQL {
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  return or(
    ...columns.map((column) => sql`${column} ilike ${pattern} escape '\\'`),
  )!;
}

/** The null guard matters: `not (… and target = y)` is NULL, not true, for a row with no item. */
function excludeFilter(
  targetColumn: AnyPgColumn,
  pairs: RecordsExcludedItem[],
): SQL {
  return or(
    isNull(targetColumn),
    not(
      or(
        ...pairs.map((pair) =>
          and(eq(forms.id, pair.formId), eq(targetColumn, pair.targetId)),
        ),
      )!,
    ),
  )!;
}

/** What a filter reads on one side of the union. */
type Branch = {
  scope: SQL;
  stateFilter: (states: RecordDisplayState[]) => BranchFilter;
  resultFilter: (results: RecordResult[]) => BranchFilter;
  timingFilter: (timings: RecordsTimingFilter[]) => BranchFilter;
  outcomeFilter: (outcomes: RecordOutcome[]) => BranchFilter;
  /** The check's and the item's names as snapshotted on this side. */
  searchColumns: readonly [AnyPgColumn, AnyPgColumn];
  targetColumn: AnyPgColumn;
  /** Null rules the branch out under a person filter: an unrecorded occurrence has nobody who recorded it. */
  recordedByColumn: AnyPgColumn | null;
};

function hasValues<T>(values: T[] | undefined): values is T[] {
  return values !== undefined && values.length > 0;
}

function combineFilters(branch: Branch, filters: RecordsFilters): SQL | null {
  const conditions: SQL[] = [branch.scope];

  if (hasValues(filters.category)) {
    conditions.push(inArray(forms.category, filters.category));
  }
  if (hasValues(filters.form)) {
    conditions.push(inArray(forms.id, filters.form));
  }
  if (hasValues(filters.target)) {
    conditions.push(inArray(branch.targetColumn, filters.target));
  }
  if (hasValues(filters.exclude)) {
    conditions.push(excludeFilter(branch.targetColumn, filters.exclude));
  }
  if (filters.search !== undefined && filters.search !== "") {
    conditions.push(searchFilter(filters.search, branch.searchColumns));
  }

  const narrowed: BranchFilter[] = [
    hasValues(filters.state) ? branch.stateFilter(filters.state) : undefined,
    hasValues(filters.result) ? branch.resultFilter(filters.result) : undefined,
    hasValues(filters.timing) ? branch.timingFilter(filters.timing) : undefined,
    hasValues(filters.outcome)
      ? branch.outcomeFilter(filters.outcome)
      : undefined,
    hasValues(filters.recordedBy)
      ? branch.recordedByColumn === null
        ? null
        : inArray(branch.recordedByColumn, filters.recordedBy)
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
    {
      scope: recordScopeCondition(params.scope),
      stateFilter: recordStateFilter,
      resultFilter: recordResultFilter,
      timingFilter: recordTimingFilter,
      outcomeFilter: recordOutcomeFilter,
      searchColumns: [taskRecords.title, taskRecords.targetName],
      targetColumn: taskRecords.targetId,
      recordedByColumn: taskRecords.recordedByUserId,
    },
    params.filters,
  );
}

function occurrenceBranchCondition(params: {
  scope: RecordsScope;
  filters: RecordsFilters;
}): SQL | null {
  return combineFilters(
    {
      scope: occurrenceScopeCondition(params.scope),
      stateFilter: occurrenceStateFilter,
      resultFilter: occurrenceResultFilter,
      timingFilter: occurrenceTimingFilter,
      outcomeFilter: occurrenceOutcomeFilter,
      searchColumns: [taskOccurrences.title, taskOccurrences.targetName],
      targetColumn: taskOccurrences.targetId,
      recordedByColumn: null,
    },
    params.filters,
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
    .leftJoin(taskOccurrences, eq(taskOccurrences.id, taskRecords.occurrenceId))
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

/** One form × item group; the item columns are null for rows with no item. */
export type RecordsJournalCountRow = {
  formId: string;
  formName: string;
  targetId: string | null;
  targetName: string | null;
  targetKind: string | null;
  areaName: string | null;
  total: number;
};

/** The item's current name, not the row snapshot: the dialog names the item as it is today. */
const journalCountColumns = {
  formId: forms.id,
  formName: forms.name,
  targetId: targets.id,
  targetName: targets.name,
  targetKind: targets.kind,
  areaName: parentTargets.name,
  total: sql<number>`count(*)`.mapWith(Number),
};

const journalCountGroupBy = [
  forms.id,
  forms.name,
  targets.id,
  targets.name,
  targets.kind,
  parentTargets.name,
];

async function countRecordsByFormAndTarget(
  db: DbClient,
  where: SQL,
): Promise<RecordsJournalCountRow[]> {
  return db
    .select(journalCountColumns)
    .from(taskRecords)
    .innerJoin(locations, eq(locations.id, taskRecords.locationId))
    .leftJoin(taskOccurrences, eq(taskOccurrences.id, taskRecords.occurrenceId))
    .innerJoin(formVersions, eq(formVersions.id, taskRecords.formVersionId))
    .innerJoin(forms, eq(forms.id, formVersions.formId))
    .leftJoin(targets, eq(targets.id, taskRecords.targetId))
    .leftJoin(parentTargets, eq(parentTargets.id, targets.parentId))
    .where(where)
    .groupBy(...journalCountGroupBy);
}

async function countUnrecordedOccurrencesByFormAndTarget(
  db: DbClient,
  where: SQL,
): Promise<RecordsJournalCountRow[]> {
  return db
    .select(journalCountColumns)
    .from(taskOccurrences)
    .innerJoin(locations, eq(locations.id, taskOccurrences.locationId))
    .innerJoin(
      formVersions,
      eq(formVersions.id, taskOccurrences.formVersionId),
    )
    .innerJoin(forms, eq(forms.id, formVersions.formId))
    .leftJoin(targets, eq(targets.id, taskOccurrences.targetId))
    .leftJoin(parentTargets, eq(parentTargets.id, targets.parentId))
    .where(where)
    .groupBy(...journalCountGroupBy);
}

export type RecordsFilterOptionRow = {
  id: string;
  name: string;
  archivedAt: Date | null;
};

export type RecordsPersonRow = {
  id: string;
  firstName: string;
  lastName: string;
};

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

  /** One entry per form × item under the same predicates as the page; the service merges the two branches. */
  async countByFormAndTarget(
    db: DbClient,
    params: RecordsScope & { filters: RecordsFilters },
  ): Promise<RecordsJournalCountRow[]> {
    const recordWhere = recordBranchCondition({ scope: params, ...params });
    const occurrenceWhere = occurrenceBranchCondition({
      scope: params,
      ...params,
    });

    const [records, occurrences] = await Promise.all([
      recordWhere ? countRecordsByFormAndTarget(db, recordWhere) : [],
      occurrenceWhere
        ? countUnrecordedOccurrencesByFormAndTarget(db, occurrenceWhere)
        : [],
    ]);

    return [...records, ...occurrences];
  },

  /** Forms with a record or an occurrence at the location, archived ones included: old rows still point at them. */
  async findFormsUsedAtLocation(
    db: DbClient,
    params: { locationId: string; organizationId: string },
  ): Promise<RecordsFilterOptionRow[]> {
    const usedFormIds = union(
      db
        .select({ formId: formVersions.formId })
        .from(taskRecords)
        .innerJoin(formVersions, eq(formVersions.id, taskRecords.formVersionId))
        .where(eq(taskRecords.locationId, params.locationId)),
      db
        .select({ formId: formVersions.formId })
        .from(taskOccurrences)
        .innerJoin(
          formVersions,
          eq(formVersions.id, taskOccurrences.formVersionId),
        )
        .where(eq(taskOccurrences.locationId, params.locationId)),
    );

    return db
      .select({ id: forms.id, name: forms.name, archivedAt: forms.archivedAt })
      .from(forms)
      .where(
        and(
          eq(forms.organizationId, params.organizationId),
          inArray(forms.id, usedFormIds),
        ),
      )
      .orderBy(forms.name, forms.id);
  },

  /** Every item of the location, archived ones included, labelled "Area › Component" like their snapshots. */
  async findTargetsOfLocation(
    db: DbClient,
    locationId: string,
  ): Promise<RecordsFilterOptionRow[]> {
    const rows = await db
      .select({
        id: targets.id,
        archivedAt: targets.archivedAt,
        ...targetLabelColumns,
      })
      .from(targets)
      .leftJoin(parentTargets, eq(parentTargets.id, targets.parentId))
      .where(eq(targets.locationId, locationId));

    return rows
      .map(withTargetLabel)
      .map((row) => ({
        id: row.id,
        name: row.targetName,
        archivedAt: row.archivedAt,
      }));
  },

  /** Everyone who has recorded a check here, members who have since left included. */
  async findRecordersAtLocation(
    db: DbClient,
    locationId: string,
  ): Promise<RecordsPersonRow[]> {
    return db
      .selectDistinct({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(taskRecords)
      .innerJoin(users, eq(users.id, taskRecords.recordedByUserId))
      .where(eq(taskRecords.locationId, locationId))
      .orderBy(users.firstName, users.lastName, users.id);
  },
};

export const recordsQueryInternals = {
  occurrenceBranchCondition,
  orderByTerms,
  recordBranchCondition,
};
