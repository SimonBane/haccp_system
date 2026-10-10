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
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
  occurrenceId: string;
  taskTemplateId: string;
  occurrenceDate: string;
  scheduledTime: string;
  availableAt: Date;
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

/**
 * Location scope plus the historical-eligibility rule: a row belongs to Records once a
 * record exists, a finite deadline has passed, or a no-deadline occurrence has opened —
 * unrecorded work with a deadline still ahead stays operational, not historical.
 */
function baseCondition(scope: RecordsScope): SQL {
  return and(
    eq(taskOccurrences.locationId, scope.locationId),
    eq(locations.organizationId, scope.organizationId),
    gte(taskOccurrences.occurrenceDate, scope.dateFrom),
    lte(taskOccurrences.occurrenceDate, scope.dateTo),
    or(
      isNotNull(taskRecords.id),
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

function displayStateCondition(state: RecordDisplayState): SQL {
  switch (state) {
    case RECORD_DISPLAY_STATE.SUBMITTED:
      return and(isNotNull(taskRecords.id), isNull(taskRecords.voidedAt))!;
    case RECORD_DISPLAY_STATE.VOIDED:
      return and(isNotNull(taskRecords.id), isNotNull(taskRecords.voidedAt))!;
    case RECORD_DISPLAY_STATE.MISSED:
      return and(isNull(taskRecords.id), isNotNull(taskOccurrences.dueAt))!;
    case RECORD_DISPLAY_STATE.OPEN:
      return and(isNull(taskRecords.id), isNull(taskOccurrences.dueAt))!;
  }
}

function resultCondition(result: RecordResult): SQL {
  switch (result) {
    case RECORD_RESULT.PASS:
      return eq(taskRecords.result, RECORD_RESULT.PASS);
    case RECORD_RESULT.FAIL:
      return eq(taskRecords.result, RECORD_RESULT.FAIL);
    case RECORD_RESULT.NOT_EVALUATED:
      return or(
        isNull(taskRecords.id),
        eq(taskRecords.result, RECORD_RESULT.NOT_EVALUATED),
      )!;
  }
}

function filterCondition(filters: RecordsFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.category && filters.category.length > 0) {
    conditions.push(inArray(forms.category, filters.category));
  }

  if (filters.state && filters.state.length > 0) {
    conditions.push(or(...filters.state.map(displayStateCondition))!);
  }

  if (filters.result && filters.result.length > 0) {
    conditions.push(or(...filters.result.map(resultCondition))!);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

/** Every ordering ends in `occurrenceId`, or limit/offset paging can repeat and drop rows. */
function orderByTerms(sortBy: RecordsSortField, sortOrder: SortOrder): SQL[] {
  const direction = sortOrder === "desc" ? desc : asc;

  if (sortBy === "title") {
    return [
      direction(taskOccurrences.title),
      asc(taskOccurrences.occurrenceDate),
      asc(taskOccurrences.scheduledTime),
      asc(taskOccurrences.id),
    ];
  }

  return [
    direction(taskOccurrences.occurrenceDate),
    direction(taskOccurrences.scheduledTime),
    asc(taskOccurrences.id),
  ];
}

export const recordsRepository = {
  async findPage(
    db: DbClient,
    params: RecordsPageParams,
  ): Promise<RecordRow[]> {
    const filters = filterCondition(params.filters);
    const where = filters
      ? and(baseCondition(params), filters)!
      : baseCondition(params);

    return db
      .select({
        occurrenceId: taskOccurrences.id,
        taskTemplateId: taskOccurrences.taskTemplateId,
        occurrenceDate: taskOccurrences.occurrenceDate,
        scheduledTime: taskOccurrences.scheduledTime,
        availableAt: taskOccurrences.availableAt,
        dueAt: taskOccurrences.dueAt,
        title: taskOccurrences.title,
        formVersionId: taskOccurrences.formVersionId,
        category: forms.category,
        targetId: taskOccurrences.targetId,
        targetName: taskOccurrences.targetName,
        resolvedLimits: taskOccurrences.resolvedLimits,
        recordId: taskRecords.id,
        recordCreatedAt: taskRecords.createdAt,
        recordedAt: taskRecords.recordedAt,
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
        recordResult: taskRecords.result,
        values: taskRecords.values,
        correctiveAction: taskRecords.correctiveAction,
      })
      .from(taskOccurrences)
      .innerJoin(locations, eq(locations.id, taskOccurrences.locationId))
      .leftJoin(taskRecords, eq(taskRecords.occurrenceId, taskOccurrences.id))
      .innerJoin(
        formVersions,
        eq(formVersions.id, taskOccurrences.formVersionId),
      )
      .innerJoin(forms, eq(forms.id, formVersions.formId))
      .leftJoin(
        createdByUser,
        eq(createdByUser.id, taskRecords.createdByUserId),
      )
      .leftJoin(
        recordedByUser,
        eq(recordedByUser.id, taskRecords.recordedByUserId),
      )
      .leftJoin(voidedByUser, eq(voidedByUser.id, taskRecords.voidedByUserId))
      .where(where)
      .orderBy(...orderByTerms(params.sortBy, params.sortOrder))
      .limit(params.limit)
      .offset(params.offset);
  },

  async countPage(
    db: DbClient,
    params: RecordsScope & { filters: RecordsFilters },
  ): Promise<number> {
    const filters = filterCondition(params.filters);
    const where = filters
      ? and(baseCondition(params), filters)!
      : baseCondition(params);

    const [row] = await db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(taskOccurrences)
      .innerJoin(locations, eq(locations.id, taskOccurrences.locationId))
      .leftJoin(taskRecords, eq(taskRecords.occurrenceId, taskOccurrences.id))
      .innerJoin(
        formVersions,
        eq(formVersions.id, taskOccurrences.formVersionId),
      )
      .innerJoin(forms, eq(forms.id, formVersions.formId))
      .where(where);

    return row?.total ?? 0;
  },
};

export const recordsQueryInternals = {
  baseCondition,
  displayStateCondition,
  filterCondition,
  orderByTerms,
  resultCondition,
};
