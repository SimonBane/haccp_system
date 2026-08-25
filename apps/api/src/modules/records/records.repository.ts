import {
  RECORD_DISPLAY_STATE,
  RECORD_RESULT,
  TEMPERATURE_RESULT,
  type RecordDisplayState,
  type RecordResult,
  type RecordsSortField,
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
import type { Db } from "../../core/db/client.js";
import { locations } from "../../core/db/schema/locations.js";
import { taskOccurrences } from "../../core/db/schema/task-occurrences.js";
import { taskRecordTemperatures } from "../../core/db/schema/task-record-temperatures.js";
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
  type?: string[];
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
  dueAt: Date;
  title: string;
  type: string;
  equipmentId: string | null;
  equipmentName: string | null;
  minTempC: string | null;
  maxTempC: string | null;
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
  temperatureRecordedC: string | null;
  temperatureMinTempC: string | null;
  temperatureMaxTempC: string | null;
  temperatureResult: string | null;
  correctiveAction: string | null;
};

/**
 * Location scope plus the historical-eligibility rule: a row belongs to Records only
 * once a record exists or its due time has passed. The organization predicate rides on
 * the `locations` join because `task_occurrences` carries no organization column.
 */
function baseCondition(scope: RecordsScope): SQL {
  return and(
    eq(taskOccurrences.locationId, scope.locationId),
    eq(locations.organizationId, scope.organizationId),
    gte(taskOccurrences.occurrenceDate, scope.dateFrom),
    lte(taskOccurrences.occurrenceDate, scope.dateTo),
    or(isNotNull(taskRecords.id), lte(taskOccurrences.dueAt, scope.now)),
  )!;
}

function displayStateCondition(state: RecordDisplayState): SQL {
  switch (state) {
    case RECORD_DISPLAY_STATE.SUBMITTED:
      return and(isNotNull(taskRecords.id), isNull(taskRecords.voidedAt))!;
    case RECORD_DISPLAY_STATE.VOIDED:
      return and(isNotNull(taskRecords.id), isNotNull(taskRecords.voidedAt))!;
    case RECORD_DISPLAY_STATE.MISSED:
      return isNull(taskRecords.id);
  }
}

function resultCondition(result: RecordResult): SQL {
  switch (result) {
    case RECORD_RESULT.PASS:
      return eq(taskRecordTemperatures.result, TEMPERATURE_RESULT.OK);
    case RECORD_RESULT.FAIL:
      return eq(taskRecordTemperatures.result, TEMPERATURE_RESULT.OUT_OF_RANGE);
    case RECORD_RESULT.NOT_EVALUATED:
      return isNull(taskRecordTemperatures.taskRecordId);
  }
}

function filterCondition(filters: RecordsFilters): SQL | undefined {
  const conditions: SQL[] = [];

  if (filters.type && filters.type.length > 0) {
    conditions.push(inArray(taskOccurrences.type, filters.type));
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
  async findPage(db: Db, params: RecordsPageParams): Promise<RecordRow[]> {
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
        dueAt: taskOccurrences.dueAt,
        title: taskOccurrences.title,
        type: taskOccurrences.type,
        equipmentId: taskOccurrences.equipmentId,
        equipmentName: taskOccurrences.equipmentName,
        minTempC: taskOccurrences.minTempC,
        maxTempC: taskOccurrences.maxTempC,
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
        temperatureRecordedC: taskRecordTemperatures.recordedC,
        temperatureMinTempC: taskRecordTemperatures.minTempC,
        temperatureMaxTempC: taskRecordTemperatures.maxTempC,
        temperatureResult: taskRecordTemperatures.result,
        correctiveAction: taskRecordTemperatures.correctiveAction,
      })
      .from(taskOccurrences)
      .innerJoin(locations, eq(locations.id, taskOccurrences.locationId))
      .leftJoin(taskRecords, eq(taskRecords.occurrenceId, taskOccurrences.id))
      .leftJoin(
        taskRecordTemperatures,
        eq(taskRecordTemperatures.taskRecordId, taskRecords.id),
      )
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
    db: Db,
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
      .leftJoin(
        taskRecordTemperatures,
        eq(taskRecordTemperatures.taskRecordId, taskRecords.id),
      )
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
