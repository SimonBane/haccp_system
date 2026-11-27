import { randomUUID } from "node:crypto";
import {
  addCalendarDays,
  calendarDateRange,
  computeAvailableAt,
  computeDueAt,
  getWeekdayFromDate,
  ORG_ROLE,
  resolveLimits,
  sortScheduledTimes,
  startOfLocalDay,
  targetDisplayName,
  TASK_TEMPLATE_COMPLETION_DUE_AFTER_DEFAULT_MINUTES,
  TASK_TEMPLATE_COMPLETION_OPENS_BEFORE_DEFAULT_MINUTES,
  wallClockToInstant,
  zonedDateString,
  type FormDefinition,
  type ResolvedLimits,
} from "@haccp/shared";
import { and, asc, desc, eq, inArray, isNull, like, notExists, or, sql } from "drizzle-orm";
import type { Db, DbTransaction } from "../../core/db/client.js";
import {
  formVersions,
  forms,
  locations,
  organizationMemberLocations,
  organizationMemberships,
  organizations,
  targets,
  taskOccurrences,
  taskRecordDeviationAnswers,
  taskRecordDeviations,
  taskRecordReadings,
  taskRecords,
  taskTemplateTargets,
  taskTemplates,
  users,
  type NewTaskOccurrence,
  type NewTaskRecord,
} from "../../core/db/schema/index.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import { taskOccurrenceService } from "../../modules/task-occurrences/task-occurrence.service.js";
import {
  toDeviationRows,
  toReadingRows,
  type JudgedDeviation,
} from "../../modules/task-records/task-record.mapper.js";
import { createRng, generateEntry, pick, randomInt, type Rng } from "./answers.js";
import {
  SEED_EMAIL_DOMAIN,
  SEED_EMAIL_PREFIX,
  SEED_FORMS,
  SEED_ON_DEMAND,
  SEED_STAFF,
  SEED_TARGETS,
  SEED_TEMPLATES,
  seedStaffEmail,
  type SeedForm,
  type SeedTarget,
} from "./catalog.js";

export type SeedOptions = {
  clerkOrgId: string;
  days: number;
  reset: boolean;
  /** Used only when the organization does not exist yet. */
  organizationName: string;
  now?: Date;
};

export type SeedSummary = {
  organizationId: string;
  organizationCreated: boolean;
  location: string;
  timeZone: string;
  firstDay: string;
  today: string;
  targets: number;
  forms: number;
  templates: number;
  staff: number;
  occurrences: number;
  records: number;
  failedRecords: number;
  voidedRecords: number;
  upcomingOccurrences: number;
};

export class SeedError extends Error {}

const CHUNK_SIZE = 500;
const MISSED_CHECK_RATE = 0.03;
const VOIDED_ON_DEMAND_RATE = 0.01;

type SeededTarget = SeedTarget & { id: string; displayName: string };
type SeededVersion = { id: string; definition: FormDefinition; effectiveFrom: string };
type SeededForm = SeedForm & { id: string; seededVersions: SeededVersion[] };
type Recorder = { userId: string; name: string };

type PendingRecord = {
  row: NewTaskRecord & { id: string };
  deviation: JudgedDeviation | null;
};

async function insertChunked<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    await insert(rows.slice(index, index + CHUNK_SIZE));
  }
}

async function findOrCreateOrganization(tx: DbTransaction, options: SeedOptions) {
  const [existing] = await tx
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.clerkOrgId, options.clerkOrgId),
        isNull(organizations.deletedAt),
      ),
    );

  if (existing) return { organization: existing, created: false };

  const [created] = await tx
    .insert(organizations)
    .values({ clerkOrgId: options.clerkOrgId, name: options.organizationName })
    .returning();
  await tx
    .insert(locations)
    .values({ organizationId: created!.id, name: "Основен обект", isDefault: true });

  return { organization: created!, created: true };
}

async function findSeedLocation(tx: DbTransaction, organizationId: string) {
  const [location] = await tx
    .select()
    .from(locations)
    .where(eq(locations.organizationId, organizationId))
    .orderBy(desc(locations.isDefault), asc(locations.createdAt))
    .limit(1);

  if (!location) throw new SeedError("The organization has no location to seed");
  return location;
}

function seedStaffEmailPattern(organizationId: string): string {
  return `${SEED_EMAIL_PREFIX}%-${organizationId.slice(0, 8)}@${SEED_EMAIL_DOMAIN}`;
}

/** Removes what an earlier run created, plus anything recorded on the seeded forms since. */
async function resetSeed(
  tx: DbTransaction,
  organizationId: string,
  locationId: string,
): Promise<void> {
  const seededForms = await tx
    .select({ id: forms.id })
    .from(forms)
    .where(
      and(
        eq(forms.organizationId, organizationId),
        inArray(forms.name, SEED_FORMS.map((form) => form.name)),
      ),
    );
  const formIds = seededForms.map((form) => form.id);

  if (formIds.length > 0) {
    const versionIds = (
      await tx
        .select({ id: formVersions.id })
        .from(formVersions)
        .where(inArray(formVersions.formId, formIds))
    ).map((version) => version.id);
    const templateIds = (
      await tx
        .select({ id: taskTemplates.id })
        .from(taskTemplates)
        .where(inArray(taskTemplates.formId, formIds))
    ).map((template) => template.id);

    await tx.delete(taskRecords).where(inArray(taskRecords.formVersionId, versionIds));
    await tx
      .delete(taskOccurrences)
      .where(inArray(taskOccurrences.formVersionId, versionIds));
    if (templateIds.length > 0) {
      await tx.delete(taskTemplates).where(inArray(taskTemplates.id, templateIds));
    }
    await tx.delete(formVersions).where(inArray(formVersions.formId, formIds));
    await tx.delete(forms).where(inArray(forms.id, formIds));
  }

  const parentNames = SEED_TARGETS.filter((target) => !target.parent).map(
    (target) => target.name,
  );
  const parents = await tx
    .select({ id: targets.id })
    .from(targets)
    .where(
      and(
        eq(targets.locationId, locationId),
        isNull(targets.parentId),
        inArray(targets.name, parentNames),
      ),
    );
  const parentIds = parents.map((target) => target.id);
  const childNames = SEED_TARGETS.filter((target) => target.parent).map(
    (target) => target.name,
  );

  if (parentIds.length > 0) {
    await tx
      .delete(targets)
      .where(
        and(
          eq(targets.locationId, locationId),
          inArray(targets.parentId, parentIds),
          inArray(targets.name, childNames),
        ),
      );
    await tx.delete(targets).where(inArray(targets.id, parentIds));
  }

  const staffPattern = seedStaffEmailPattern(organizationId);
  const staffIds = (
    await tx
      .select({ id: users.id })
      .from(users)
      .where(like(users.email, staffPattern))
  ).map((user) => user.id);

  if (staffIds.length > 0) {
    await tx
      .delete(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, organizationId),
          inArray(organizationMemberships.userId, staffIds),
        ),
      );
    await tx
      .delete(users)
      .where(
        and(
          inArray(users.id, staffIds),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(organizationMemberships)
              .where(eq(organizationMemberships.userId, users.id)),
          ),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(taskRecords)
              .where(
                or(
                  eq(taskRecords.createdByUserId, users.id),
                  eq(taskRecords.recordedByUserId, users.id),
                  eq(taskRecords.voidedByUserId, users.id),
                ),
              ),
          ),
        ),
      );
  }
}

async function seedStaff(
  tx: DbTransaction,
  organizationId: string,
  locationId: string,
): Promise<Recorder[]> {
  const emails = SEED_STAFF.map((staff) => seedStaffEmail(staff.slug, organizationId));

  await tx
    .insert(users)
    .values(
      SEED_STAFF.map((staff, index) => ({
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: emails[index]!,
      })),
    )
    .onConflictDoNothing();

  const staffUsers = await tx
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(inArray(users.email, emails));

  const memberships = await tx
    .insert(organizationMemberships)
    .values(
      staffUsers.map((user) => ({
        organizationId,
        userId: user.id,
        role: ORG_ROLE.EMPLOYEE,
        status: MEMBERSHIP_STATUS.DRAFT,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: organizationMemberships.id });

  if (memberships.length > 0) {
    await tx
      .insert(organizationMemberLocations)
      .values(
        memberships.map((membership) => ({
          membershipId: membership.id,
          locationId,
          organizationId,
        })),
      )
      .onConflictDoNothing();
  }

  return staffUsers.map((user) => ({
    userId: user.id,
    name: `${user.firstName} ${user.lastName}`,
  }));
}

async function findActiveMembers(
  tx: DbTransaction,
  organizationId: string,
): Promise<Recorder[]> {
  const rows = await tx
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(organizationMemberships)
    .innerJoin(users, eq(users.id, organizationMemberships.userId))
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.status, MEMBERSHIP_STATUS.ACTIVE),
        isNull(organizationMemberships.deletedAt),
        isNull(users.deletedAt),
      ),
    );

  return rows.map((user) => ({
    userId: user.id,
    name: `${user.firstName} ${user.lastName}`,
  }));
}

async function seedTargets(
  tx: DbTransaction,
  locationId: string,
  createdAt: Date,
): Promise<Map<string, SeededTarget>> {
  const seeded = new Map<string, SeededTarget>();
  const parentsFirst = [
    ...SEED_TARGETS.filter((target) => !target.parent),
    ...SEED_TARGETS.filter((target) => target.parent),
  ];

  for (const target of parentsFirst) {
    const parent = target.parent ? seeded.get(target.parent) : undefined;
    const [row] = await tx
      .insert(targets)
      .values({
        locationId,
        kind: target.kind,
        name: target.name,
        parentId: parent?.id ?? null,
        limits: target.limits ?? {},
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: targets.id });
    seeded.set(target.key, {
      ...target,
      id: row!.id,
      displayName: targetDisplayName(target, parent?.name),
    });
  }

  return seeded;
}

async function seedForms(
  tx: DbTransaction,
  organizationId: string,
  baseline: { date: string; instant: Date },
  today: string,
  timeZone: string,
): Promise<Map<string, SeededForm>> {
  const seeded = new Map<string, SeededForm>();

  for (const form of SEED_FORMS) {
    const [row] = await tx
      .insert(forms)
      .values({
        organizationId,
        name: form.name,
        category: form.category,
        appliesTo: form.appliesTo,
        onDemand: form.onDemand,
        createdAt: baseline.instant,
        updatedAt: baseline.instant,
      })
      .returning({ id: forms.id });

    const seededVersions: SeededVersion[] = [];
    for (const [index, version] of form.versions.entries()) {
      const effectiveFrom =
        version.publishedDaysAgo === null
          ? baseline.date
          : addCalendarDays(today, -version.publishedDaysAgo);
      const createdAt =
        version.publishedDaysAgo === null
          ? baseline.instant
          : wallClockToInstant(effectiveFrom, "06:00", timeZone);
      const [versionRow] = await tx
        .insert(formVersions)
        .values({
          formId: row!.id,
          version: index + 1,
          definition: version.definition,
          createdAt,
        })
        .returning({ id: formVersions.id });
      seededVersions.push({
        id: versionRow!.id,
        definition: version.definition,
        effectiveFrom,
      });
    }

    seeded.set(form.key, { ...form, id: row!.id, seededVersions });
  }

  return seeded;
}

function versionOn(form: SeededForm, date: string): SeededVersion {
  const versions = form.seededVersions.filter(
    (version) => version.effectiveFrom <= date,
  );
  return versions.at(-1) ?? form.seededVersions[0]!;
}

function buildRecord(params: {
  rng: Rng;
  form: SeededForm;
  version: SeededVersion;
  locationId: string;
  target: SeededTarget | null;
  resolvedLimits: ResolvedLimits;
  entryDate: string;
  entryTime: string;
  recordedAt: Date;
  recorder: Recorder;
  staffNames: string[];
  employeeName?: string;
  occurrence?: { id: string; taskTemplateId: string };
}): PendingRecord {
  const entry = generateEntry({
    form: params.form,
    definition: params.version.definition,
    resolvedLimits: params.resolvedLimits,
    typicalTemperature: params.target?.typicalTemperature,
    entryDate: params.entryDate,
    staffNames: params.staffNames,
    employeeName: params.employeeName,
    rng: params.rng,
  });

  return {
    row: {
      id: randomUUID(),
      locationId: params.locationId,
      taskTemplateId: params.occurrence?.taskTemplateId ?? null,
      occurrenceId: params.occurrence?.id ?? null,
      title: params.form.name,
      formVersionId: params.version.id,
      targetId: params.target?.id ?? null,
      targetName: params.target?.displayName ?? null,
      resolvedLimits: params.resolvedLimits,
      entryDate: params.entryDate,
      entryTime: params.entryTime,
      values: entry.values,
      result: entry.result,
      correctiveAction: entry.corrective?.text ?? null,
      createdAt: params.recordedAt,
      createdByUserId: params.recorder.userId,
      recordedAt: params.recordedAt,
      recordedByUserId: params.recorder.userId,
    },
    deviation: entry.corrective
      ? {
          failedFieldIds: entry.failedFieldIds,
          answers: entry.corrective.answers,
          note: entry.corrective.note,
        }
      : null,
  };
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 60 + minutes!;
}

function timeOf(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function laterThan(instant: Date, minutes: number, cap: Date): Date {
  return new Date(Math.min(instant.getTime() + minutes * 60_000, cap.getTime()));
}

async function writeRecords(tx: DbTransaction, pending: PendingRecord[]): Promise<void> {
  const deviations = new Map(
    pending.flatMap((record) =>
      record.deviation ? [[record.row.id, record.deviation] as const] : [],
    ),
  );

  await insertChunked(pending, async (chunk) => {
    const inserted = await tx
      .insert(taskRecords)
      .values(chunk.map((record) => record.row))
      .returning();

    const readings = inserted.flatMap((record) =>
      toReadingRows({
        recordId: record.id,
        locationId: record.locationId,
        targetId: record.targetId,
        recordedAt: record.recordedAt,
        values: record.values,
      }),
    );
    if (readings.length > 0) await tx.insert(taskRecordReadings).values(readings);

    for (const record of inserted) {
      const deviation = deviations.get(record.id);
      if (!deviation) continue;
      const { row, answers } = toDeviationRows(record, deviation);
      const [created] = await tx
        .insert(taskRecordDeviations)
        .values(row)
        .returning({ id: taskRecordDeviations.id });
      if (answers.length > 0) {
        await tx
          .insert(taskRecordDeviationAnswers)
          .values(answers.map((answer) => ({ ...answer, deviationId: created!.id })));
      }
    }
  });
}

export async function seedOrganization(
  db: Db,
  options: SeedOptions,
): Promise<SeedSummary> {
  const now = options.now ?? new Date();

  return db.transaction(async (tx) => {
    const { organization, created } = await findOrCreateOrganization(tx, options);
    const location = await findSeedLocation(tx, organization.id);
    const timeZone = organization.timezone;
    const rng = createRng(`${organization.id}:${options.days}`);

    if (options.reset) {
      await resetSeed(tx, organization.id, location.id);
    } else {
      const [alreadySeeded] = await tx
        .select({ id: forms.id })
        .from(forms)
        .where(
          and(
            eq(forms.organizationId, organization.id),
            isNull(forms.archivedAt),
            inArray(forms.name, SEED_FORMS.map((form) => form.name)),
          ),
        )
        .limit(1);
      if (alreadySeeded) {
        throw new SeedError(
          "This organization already has seed data; rerun with --reset to replace it",
        );
      }
    }

    const today = zonedDateString(now, timeZone);
    const firstDay = addCalendarDays(today, -options.days);
    const baselineDate = addCalendarDays(firstDay, -1);
    const baseline = {
      date: baselineDate,
      instant: wallClockToInstant(baselineDate, "06:00", timeZone),
    };
    const dates = calendarDateRange(firstDay, options.days + 1);

    const staff = await seedStaff(tx, organization.id, location.id);
    const members = await findActiveMembers(tx, organization.id);
    const recorders = [...staff, ...staff, ...members];
    const staffNames = staff.map((member) => member.name);

    const seededTargets = await seedTargets(tx, location.id, baseline.instant);
    const seededForms = await seedForms(
      tx,
      organization.id,
      baseline,
      today,
      timeZone,
    );

    const templateIds: string[] = [];
    const occurrences: (NewTaskOccurrence & { id: string })[] = [];

    for (const template of SEED_TEMPLATES) {
      const form = seededForms.get(template.form)!;
      const [templateRow] = await tx
        .insert(taskTemplates)
        .values({
          locationId: location.id,
          formId: form.id,
          weekdays: template.weekdays,
          scheduledTimes: template.times,
          completionOpensBeforeMinutes:
            TASK_TEMPLATE_COMPLETION_OPENS_BEFORE_DEFAULT_MINUTES,
          completionDueAfterMinutes:
            TASK_TEMPLATE_COMPLETION_DUE_AFTER_DEFAULT_MINUTES,
          createdAt: baseline.instant,
          updatedAt: baseline.instant,
        })
        .returning();
      templateIds.push(templateRow!.id);

      const templateTargets = template.targets.map((key) => seededTargets.get(key)!);
      await tx.insert(taskTemplateTargets).values(
        templateTargets.map((target) => ({
          taskTemplateId: templateRow!.id,
          targetId: target.id,
          locationId: location.id,
        })),
      );

      for (const date of dates) {
        if (!template.weekdays.includes(getWeekdayFromDate(date))) continue;
        const version = versionOn(form, date);
        const dayStart = startOfLocalDay(date, timeZone);

        for (const time of sortScheduledTimes(template.times)) {
          const scheduledInstant = wallClockToInstant(date, time, timeZone);
          // Today's later slots are left to the app's own reconciliation below.
          if (scheduledInstant.getTime() > now.getTime()) continue;

          for (const target of templateTargets) {
            occurrences.push({
              id: randomUUID(),
              locationId: location.id,
              taskTemplateId: templateRow!.id,
              occurrenceDate: date,
              scheduledTime: time,
              availableAt: computeAvailableAt({
                scheduledInstant,
                startOfLocalDay: dayStart,
                completionOpensBeforeMinutes:
                  templateRow!.completionOpensBeforeMinutes,
              }),
              dueAt: computeDueAt({
                scheduledInstant,
                completionDueAfterMinutes: templateRow!.completionDueAfterMinutes,
              }),
              title: form.name,
              formVersionId: version.id,
              targetId: target.id,
              targetName: target.displayName,
              resolvedLimits: resolveLimits(version.definition, target.limits ?? null),
            });
          }
        }
      }
    }

    await insertChunked(occurrences, (chunk) =>
      tx.insert(taskOccurrences).values(chunk),
    );

    const targetsById = new Map(
      [...seededTargets.values()].map((target) => [target.id, target]),
    );
    const formsByVersionId = new Map(
      [...seededForms.values()].flatMap((form) =>
        form.seededVersions.map((version) => [version.id, { form, version }] as const),
      ),
    );

    const pending: PendingRecord[] = [];
    for (const occurrence of occurrences) {
      if (rng() < MISSED_CHECK_RATE) continue;
      const { form, version } = formsByVersionId.get(occurrence.formVersionId)!;
      const scheduledInstant = wallClockToInstant(
        occurrence.occurrenceDate,
        occurrence.scheduledTime,
        timeZone,
      );
      pending.push(
        buildRecord({
          rng,
          form,
          version,
          locationId: location.id,
          target: targetsById.get(occurrence.targetId!) ?? null,
          resolvedLimits: occurrence.resolvedLimits!,
          entryDate: occurrence.occurrenceDate,
          entryTime: occurrence.scheduledTime,
          recordedAt: laterThan(scheduledInstant, randomInt(rng, -10, 40), now),
          recorder: pick(rng, recorders),
          staffNames,
          occurrence: { id: occurrence.id, taskTemplateId: occurrence.taskTemplateId },
        }),
      );
    }

    let voidedRecords = 0;
    for (const plan of SEED_ON_DEMAND) {
      const form = seededForms.get(plan.form)!;
      const planTargets = plan.targets.map((key) => seededTargets.get(key)!);
      const [windowStart, windowEnd] = plan.window.map(minutesOf) as [number, number];

      for (const date of dates) {
        if (!plan.weekdays.includes(getWeekdayFromDate(date))) continue;
        const version = versionOn(form, date);
        const subjects =
          plan.perDay === "each_staff"
            ? staff.map((member) => member.name)
            : Array.from({ length: randomInt(rng, ...plan.perDay) }, () => undefined);

        for (const employeeName of subjects) {
          const minutes =
            windowStart + Math.floor((rng() * (windowEnd - windowStart)) / 5) * 5;
          const entryTime = timeOf(minutes);
          const entryInstant = wallClockToInstant(date, entryTime, timeZone);
          if (entryInstant.getTime() > now.getTime()) continue;

          const target = planTargets.length > 0 ? pick(rng, planTargets) : null;
          const record = buildRecord({
            rng,
            form,
            version,
            locationId: location.id,
            target,
            resolvedLimits: resolveLimits(version.definition, target?.limits ?? null),
            entryDate: date,
            entryTime,
            recordedAt: laterThan(entryInstant, randomInt(rng, 0, 15), now),
            recorder: pick(rng, recorders),
            staffNames,
            employeeName,
          });
          if (rng() < VOIDED_ON_DEMAND_RATE) {
            record.row.voidedAt = laterThan(record.row.recordedAt, 60, now);
            record.row.voidedByUserId = record.row.recordedByUserId;
            voidedRecords += 1;
          }
          pending.push(record);
        }
      }
    }

    pending.sort((a, b) => a.row.recordedAt.getTime() - b.row.recordedAt.getTime());
    await writeRecords(tx, pending);

    const reconciled = await taskOccurrenceService.reconcileTemplateIds(tx, {
      templateIds,
      timeZone,
    });

    return {
      organizationId: organization.id,
      organizationCreated: created,
      location: location.name,
      timeZone,
      firstDay,
      today,
      targets: seededTargets.size,
      forms: seededForms.size,
      templates: templateIds.length,
      staff: staff.length,
      occurrences: occurrences.length,
      records: pending.length,
      failedRecords: pending.filter((record) => record.row.result === "fail").length,
      voidedRecords,
      upcomingOccurrences: reconciled.created,
    };
  });
}
