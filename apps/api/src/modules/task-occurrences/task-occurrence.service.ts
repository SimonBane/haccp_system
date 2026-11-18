import {
  calendarDateRange,
  computeAvailableAt,
  computeDueAt,
  getWeekdayFromDate,
  isValidTimeZone,
  resolveLimits,
  sortScheduledTimes,
  startOfLocalDay,
  wallClockToInstant,
  zonedDateString,
  type ResolvedLimits,
} from "@haccp/shared";
import type { Db, DbClient } from "../../core/db/client.js";
import { InternalError } from "../../core/errors/app-errors.js";
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
  formVersionId: string;
  targetId: string | null;
  targetName: string | null;
  resolvedLimits: ResolvedLimits;
};

function desiredKey(
  templateId: string,
  targetId: string | null,
  date: string,
  time: string,
): string {
  return `${templateId}|${targetId ?? ""}|${date}|${time}`;
}

function existingKey(row: TaskOccurrenceRow): string {
  return desiredKey(
    row.taskTemplateId,
    row.targetId,
    row.occurrenceDate,
    row.scheduledTime,
  );
}

/** jsonb returns keys in its own order, so limits are compared on a key-sorted encoding. */
function limitsKey(limits: ResolvedLimits): string {
  return JSON.stringify(
    Object.keys(limits)
      .sort()
      .map((fieldId) => [fieldId, limits[fieldId]!.min, limits[fieldId]!.max]),
  );
}

/** A template with no targets still gets one occurrence per slot, about nothing in particular. */
function slotsFor(
  source: TaskTemplateSourceRow,
): {
  targetId: string | null;
  targetName: string | null;
  resolvedLimits: ResolvedLimits;
}[] {
  if (source.targets.length === 0) {
    return [
      {
        targetId: null,
        targetName: null,
        resolvedLimits: resolveLimits(source.definition, null),
      },
    ];
  }

  return source.targets.map((target) => ({
    targetId: target.targetId,
    targetName: target.targetName,
    resolvedLimits: resolveLimits(source.definition, target.limitOverrides),
  }));
}

function buildDesiredOccurrences(
  sources: TaskTemplateSourceRow[],
  dates: string[],
  timeZone: string,
): Map<string, DesiredOccurrence> {
  const desired = new Map<string, DesiredOccurrence>();

  for (const source of sources) {
    const times = sortScheduledTimes(source.scheduledTimes);
    const slots = slotsFor(source);

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

        for (const slot of slots) {
          desired.set(desiredKey(source.id, slot.targetId, date, time), {
            taskTemplateId: source.id,
            locationId: source.locationId,
            occurrenceDate: date,
            scheduledTime: time,
            availableAt,
            dueAt,
            title: source.title,
            formVersionId: source.formVersionId,
            targetId: slot.targetId,
            targetName: slot.targetName,
            resolvedLimits: slot.resolvedLimits,
          });
        }
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
    existingRow.formVersionId === desiredRow.formVersionId &&
    existingRow.targetName === desiredRow.targetName &&
    limitsKey(existingRow.resolvedLimits) ===
      limitsKey(desiredRow.resolvedLimits) &&
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
    formVersionId: row.formVersionId,
    targetId: row.targetId,
    targetName: row.targetName,
    resolvedLimits: row.resolvedLimits,
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
  const dates = calendarDateRange(
    currentLocalDate,
    MATERIALIZATION_WINDOW_DAYS,
  );

  const [sources, existing] = await Promise.all([
    taskTemplateRepository.findActiveSourcesByIds(db, templateIds),
    taskOccurrenceRepository.findByTemplateIds(db, templateIds),
  ]);

  const desired = buildDesiredOccurrences(sources, dates, timeZone);

  const recordedOccurrenceIds =
    await taskOccurrenceRepository.findRecordedOccurrenceIds(
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

  /** For a change outside a template (a renamed or archived target) that alters what its occurrences copy. */
  async reconcileTemplatesAtLocation(
    db: DbClient,
    locationId: string,
    templateIds: string[],
  ): Promise<ReconcileSummary> {
    if (templateIds.length === 0) {
      return { processed: 0, created: 0, replaced: 0, deleted: 0 };
    }

    const org = await locationRepository.findOrganizationContextByLocationId(
      db,
      locationId,
    );

    if (!org) {
      throw new InternalError(
        "Location has no organization for occurrence reconciliation",
      );
    }

    return reconcileTemplateIds(db, { templateIds, timeZone: org.timeZone });
  },

  async reconcileOrganization(
    db: DbClient,
    organizationId: string,
    timeZone: string,
  ): Promise<ReconcileSummary> {
    const templateIds =
      await taskTemplateRepository.findActiveIdsByOrganization(
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
