import {
  calendarDateRange,
  computeAvailableAt,
  computeDueAt,
  getWeekdayFromDate,
  isValidTimeZone,
  sortScheduledTimes,
  startOfLocalDay,
  TASK_TEMPLATE_TYPE,
  wallClockToInstant,
  zonedDateString,
  type TaskTemplateType,
} from "@haccp/shared";
import type { Db, DbClient } from "../../core/db/client.js";
import { InternalError, ValidationError } from "../../core/errors/app-errors.js";
import { logger } from "../../lib/logger.js";
import { locationRepository } from "../locations/location.repository.js";
import { organizationRepository } from "../organizations/organization.repository.js";
import {
  taskTemplateRepository,
  type TaskTemplateSourceRow,
} from "../task-templates/task-template.repository.js";
import {
  taskOccurrenceRepository,
  type NewTaskOccurrenceRow,
  type TaskOccurrenceRow,
} from "./task-occurrence.repository.js";

const MATERIALIZATION_WINDOW_DAYS = 14;

export type ReconcileSummary = {
  processed: number;
  created: number;
  replaced: number;
  deleted: number;
};

type DesiredOccurrence = {
  taskTemplateId: string;
  locationId: string;
  occurrenceDate: string;
  scheduledTime: string;
  availableAt: Date;
  dueAt: Date | null;
  title: string;
  type: TaskTemplateType;
  equipmentId: string | null;
  equipmentName: string | null;
  minTempC: string | null;
  maxTempC: string | null;
};

function desiredKey(templateId: string, date: string, time: string): string {
  return `${templateId}|${date}|${time}`;
}

function existingKey(row: TaskOccurrenceRow): string {
  return desiredKey(row.taskTemplateId, row.occurrenceDate, row.scheduledTime);
}

function assertResolvedTemperatureSource(source: TaskTemplateSourceRow): void {
  if (source.type !== TASK_TEMPLATE_TYPE.TEMPERATURE) return;

  if (
    !source.equipmentId ||
    source.equipmentName === null ||
    source.minTempC === null ||
    source.maxTempC === null
  ) {
    throw new ValidationError(
      `Task template "${source.title}" has no valid same-location equipment for temperature occurrences`,
    );
  }
}

function buildDesiredOccurrences(
  sources: TaskTemplateSourceRow[],
  dates: string[],
  timeZone: string,
): Map<string, DesiredOccurrence> {
  const desired = new Map<string, DesiredOccurrence>();

  for (const source of sources) {
    assertResolvedTemperatureSource(source);

    const times = sortScheduledTimes(source.scheduledTimes);

    for (const date of dates) {
      const weekday = getWeekdayFromDate(date);
      if (!source.weekdays.includes(weekday)) continue;

      const dayStart = startOfLocalDay(date, timeZone);

      for (const time of times) {
        const scheduledInstant = wallClockToInstant(date, time, timeZone);

        if (scheduledInstant.getTime() < source.createdAt.getTime()) continue;

        const availableAt = computeAvailableAt({
          scheduledInstant,
          startOfLocalDay: dayStart,
          completionOpensBeforeMinutes: source.completionOpensBeforeMinutes,
        });
        const dueAt = computeDueAt({
          scheduledInstant,
          completionDueAfterMinutes: source.completionDueAfterMinutes,
        });

        desired.set(desiredKey(source.id, date, time), {
          taskTemplateId: source.id,
          locationId: source.locationId,
          occurrenceDate: date,
          scheduledTime: time,
          availableAt,
          dueAt,
          title: source.title,
          type: source.type,
          equipmentId:
            source.type === TASK_TEMPLATE_TYPE.TEMPERATURE
              ? source.equipmentId
              : null,
          equipmentName:
            source.type === TASK_TEMPLATE_TYPE.TEMPERATURE
              ? source.equipmentName
              : null,
          minTempC:
            source.type === TASK_TEMPLATE_TYPE.TEMPERATURE
              ? source.minTempC
              : null,
          maxTempC:
            source.type === TASK_TEMPLATE_TYPE.TEMPERATURE
              ? source.maxTempC
              : null,
        });
      }
    }
  }

  return desired;
}

function matchesDesired(
  existingRow: TaskOccurrenceRow,
  desiredRow: DesiredOccurrence,
): boolean {
  return (
    existingRow.title === desiredRow.title &&
    existingRow.type === desiredRow.type &&
    existingRow.equipmentId === desiredRow.equipmentId &&
    existingRow.equipmentName === desiredRow.equipmentName &&
    existingRow.minTempC === desiredRow.minTempC &&
    existingRow.maxTempC === desiredRow.maxTempC &&
    existingRow.availableAt.getTime() === desiredRow.availableAt.getTime() &&
    (existingRow.dueAt?.getTime() ?? null) ===
      (desiredRow.dueAt?.getTime() ?? null)
  );
}

function toInsertRow(row: DesiredOccurrence): NewTaskOccurrenceRow {
  return {
    taskTemplateId: row.taskTemplateId,
    locationId: row.locationId,
    occurrenceDate: row.occurrenceDate,
    scheduledTime: row.scheduledTime,
    availableAt: row.availableAt,
    dueAt: row.dueAt,
    title: row.title,
    type: row.type,
    equipmentId: row.equipmentId,
    equipmentName: row.equipmentName,
    minTempC: row.minTempC,
    maxTempC: row.maxTempC,
  };
}

/**
 * The reconciliation engine. Callable directly so future coordination (chunking,
 * leases, queues) can wrap it without changing occurrence identity.
 *
 * Must run inside a transaction: callers either pass an already-open `tx` (a
 * configuration write reconciling in the same transaction as its write) or open
 * one themselves (the daily job, per organization).
 */
async function reconcileTemplateIds(
  db: DbClient,
  params: { templateIds: string[]; timeZone: string },
): Promise<ReconcileSummary> {
  const { templateIds, timeZone } = params;

  if (templateIds.length === 0) {
    return { processed: 0, created: 0, replaced: 0, deleted: 0 };
  }

  if (!isValidTimeZone(timeZone)) {
    throw new InternalError("Organization timezone configuration is invalid");
  }

  const now = new Date();
  const currentLocalDate = zonedDateString(now, timeZone);
  const dates = calendarDateRange(currentLocalDate, MATERIALIZATION_WINDOW_DAYS);

  const [sources, existing] = await Promise.all([
    taskTemplateRepository.findActiveWithEquipmentByIds(db, templateIds),
    taskOccurrenceRepository.findByTemplateIds(db, templateIds),
  ]);

  const desired = buildDesiredOccurrences(sources, dates, timeZone);

  const recordedOccurrenceIds = await taskOccurrenceRepository.findRecordedOccurrenceIds(
    db,
    existing.map((row) => row.id),
  );

  const toDeleteIds: string[] = [];
  const newInserts: DesiredOccurrence[] = [];
  const replaceInserts: DesiredOccurrence[] = [];

  for (const existingRow of existing) {
    const key = existingKey(existingRow);
    const isRecorded = recordedOccurrenceIds.has(existingRow.id);
    const desiredRow = desired.get(key);

    if (!desiredRow) {
      // No longer desired: the slot changed, or the template was archived. An occurrence
      // that already opened (or holds a record, voided or not) is history now — it must
      // survive even after dropping out of the desired set — so only delete one that was
      // never opened and never recorded.
      if (isRecorded || existingRow.availableAt.getTime() <= now.getTime()) {
        continue;
      }
      toDeleteIds.push(existingRow.id);
      continue;
    }

    if (isRecorded) {
      // A record (voided or not) locks the occurrence in permanently — never replaced.
      desired.delete(key);
      continue;
    }

    if (!matchesDesired(existingRow, desiredRow)) {
      toDeleteIds.push(existingRow.id);
      replaceInserts.push(desiredRow);
    }

    desired.delete(key);
  }

  for (const desiredRow of desired.values()) {
    newInserts.push(desiredRow);
  }

  if (toDeleteIds.length > 0) {
    await taskOccurrenceRepository.deleteByIds(db, toDeleteIds);
  }

  const toInsert = [...replaceInserts, ...newInserts];
  if (toInsert.length > 0) {
    await taskOccurrenceRepository.insertMany(db, toInsert.map(toInsertRow));
  }

  return {
    processed: sources.length,
    created: newInserts.length,
    replaced: replaceInserts.length,
    deleted: toDeleteIds.length - replaceInserts.length,
  };
}

export const taskOccurrenceService = {
  reconcileTemplateIds,

  async reconcileTemplate(
    db: DbClient,
    locationId: string,
    templateId: string,
  ): Promise<ReconcileSummary> {
    const org = await locationRepository.findOrganizationContextByLocationId(
      db,
      locationId,
    );

    if (!org) {
      throw new InternalError(
        "Location has no organization for occurrence reconciliation",
      );
    }

    return reconcileTemplateIds(db, {
      templateIds: [templateId],
      timeZone: org.timeZone,
    });
  },

  async reconcileEquipment(
    db: DbClient,
    locationId: string,
    equipmentId: string,
  ): Promise<ReconcileSummary> {
    const org = await locationRepository.findOrganizationContextByLocationId(
      db,
      locationId,
    );

    if (!org) {
      throw new InternalError(
        "Location has no organization for occurrence reconciliation",
      );
    }

    const templateIds = await taskTemplateRepository.findActiveIdsByLocationAndEquipment(
      db,
      locationId,
      equipmentId,
    );

    return reconcileTemplateIds(db, { templateIds, timeZone: org.timeZone });
  },

  async reconcileOrganization(
    db: DbClient,
    organizationId: string,
    timeZone: string,
  ): Promise<ReconcileSummary> {
    const templateIds = await taskTemplateRepository.findActiveIdsByOrganization(
      db,
      organizationId,
    );

    return reconcileTemplateIds(db, { templateIds, timeZone });
  },

  async reconcileAllOrganizations(
    db: Db,
  ): Promise<ReconcileSummary & { organizations: number }> {
    const orgs = await organizationRepository.findAllActive(db);

    const totals = {
      organizations: orgs.length,
      processed: 0,
      created: 0,
      replaced: 0,
      deleted: 0,
    };

    for (const org of orgs) {
      try {
        const summary = await db.transaction((tx) =>
          taskOccurrenceService.reconcileOrganization(tx, org.id, org.timeZone),
        );

        totals.processed += summary.processed;
        totals.created += summary.created;
        totals.replaced += summary.replaced;
        totals.deleted += summary.deleted;
      } catch (error) {
        logger.error(
          { err: error, organizationId: org.id },
          "Task occurrence reconciliation failed for organization",
        );
      }
    }

    return totals;
  },
};
