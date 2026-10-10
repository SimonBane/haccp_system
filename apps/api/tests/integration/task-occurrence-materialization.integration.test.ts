import {
  addCalendarDays,
  getWeekdayFromDate,
  zonedDateString,
  zonedMinutesOfDay,
} from "@haccp/shared";
import { and, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  taskOccurrences,
  taskRecords,
  taskTemplates,
} from "../../src/core/db/schema/index.js";
import {
  CLEANING_DEFINITION,
  FRIDGE_FIELD_ID,
  seedOrganization,
  type SeededOrg,
  type TwoTenantWorld,
} from "./harness/fixtures.js";
import { apiRequest, asAdmin } from "./harness/request.js";

const TZ = "Europe/Sofia";
const CRON_SECRET = process.env.CRON_SECRET ?? "test-cron-secret-integration";

function todayLocal(): string {
  return zonedDateString(new Date(), TZ);
}

/** A HH:MM strictly before "now" today (half the elapsed local minutes) — deterministic regardless of run time. */
function pastTimeToday(): string {
  const minutes = Math.floor(zonedMinutesOfDay(new Date(), TZ) / 2);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

async function materialize(): Promise<Response> {
  return apiRequest("/internal/task-occurrences/materialize", {
    method: "GET",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
}

async function findOccurrence(
  templateId: string,
  occurrenceDate: string,
  scheduledTime: string,
) {
  const [row] = await db
    .select()
    .from(taskOccurrences)
    .where(
      and(
        eq(taskOccurrences.taskTemplateId, templateId),
        eq(taskOccurrences.occurrenceDate, occurrenceDate),
        eq(taskOccurrences.scheduledTime, scheduledTime),
      ),
    );
  return row ?? null;
}

/** Any record — voided or not — locks its occurrence against reconciliation. */
async function recordOccurrence(
  world: SeededOrg,
  occurrence: { id: string; formVersionId: string },
  options: { voided?: boolean } = {},
): Promise<void> {
  await db.insert(taskRecords).values({
    occurrenceId: occurrence.id,
    formVersionId: occurrence.formVersionId,
    values: {},
    result: "not_evaluated",
    createdByUserId: world.admin.userId,
    recordedAt: new Date(),
    recordedByUserId: world.admin.userId,
    ...(options.voided
      ? { voidedAt: new Date(), voidedByUserId: world.admin.userId }
      : {}),
  });
}

function cleaningTemplateBody(
  world: SeededOrg,
  overrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    title: world.templates.cleaning.title,
    formId: world.forms.cleaning.id,
    weekdays: [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ],
    scheduledTimes: ["09:00"],
    ...overrides,
  });
}

async function findOccurrencesByTemplate(templateId: string) {
  return db
    .select()
    .from(taskOccurrences)
    .where(eq(taskOccurrences.taskTemplateId, templateId));
}

/**
 * `seedOrganization` inserts templates at "now", so any scheduled time earlier
 * today than the real run time is legitimately cut off. Backdating lets tests
 * that aren't specifically about the cutoff generate a full, deterministic
 * 14-day window regardless of what time the suite happens to run.
 */
async function backdateSeededTemplates(world: SeededOrg): Promise<void> {
  await db
    .update(taskTemplates)
    .set({ createdAt: new Date("2020-01-01T00:00:00Z") })
    .where(
      inArray(taskTemplates.id, [
        world.templates.temperature.id,
        world.templates.cleaning.id,
      ]),
    );
}

describe("Task occurrence materialization — daily job", () => {
  let world: SeededOrg;

  beforeEach(async () => {
    world = await seedOrganization(db);
    await backdateSeededTemplates(world);
  });

  it("materializes every desired slot for the current 14-day window", async () => {
    const response = await materialize();
    expect(response.status).toBe(200);

    const rows = await findOccurrencesByTemplate(
      world.templates.temperature.id,
    );
    // Weekdays cover every day, one scheduled time -> exactly 14 rows.
    expect(rows).toHaveLength(14);
    expect(rows.map((r) => r.occurrenceDate).sort()).toEqual(
      Array.from({ length: 14 }, (_, i) =>
        addCalendarDays(todayLocal(), i),
      ).sort(),
    );
  });

  it("repeated generation creates no duplicates", async () => {
    await materialize();
    const first = await findOccurrencesByTemplate(
      world.templates.temperature.id,
    );

    const second = await materialize();
    expect(second.status).toBe(200);
    const after = await findOccurrencesByTemplate(
      world.templates.temperature.id,
    );

    expect(after).toHaveLength(first.length);
    expect(after.map((r) => r.id).sort()).toEqual(
      first.map((r) => r.id).sort(),
    );
  });

  it("restores a past-due occurrence a delayed run missed, when the template existed before dueAt", async () => {
    const weekday = getWeekdayFromDate(todayLocal());
    const [longLivedTemplate] = await db
      .insert(taskTemplates)
      .values({
        locationId: world.locations.main.id,
        title: "Long-lived cleaning check",
        formId: world.forms.cleaning.id,
        weekdays: [weekday],
        scheduledTimes: [pastTimeToday()],
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // created yesterday
      })
      .returning();

    const response = await materialize();
    expect(response.status).toBe(200);

    const occurrence = await findOccurrence(
      longLivedTemplate!.id,
      todayLocal(),
      pastTimeToday(),
    );
    expect(occurrence).not.toBeNull();
    expect(occurrence!.dueAt!.getTime()).toBeLessThan(Date.now());
  });

  it("reaches only locations belonging to each organization", async () => {
    const two: TwoTenantWorld = {
      alpha: world,
      beta: await seedOrganization(db, { slug: "beta" }),
    };

    const response = await materialize();
    expect(response.status).toBe(200);

    for (const org of [two.alpha, two.beta]) {
      const rows = await findOccurrencesByTemplate(
        org.templates.temperature.id,
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.locationId).toBe(org.locations.main.id);
      }
    }
  });
});

describe("Task occurrence materialization — cron secret", () => {
  it("rejects a request with no Authorization header", async () => {
    const response = await apiRequest("/internal/task-occurrences/materialize");
    expect(response.status).toBe(401);
  });

  it("rejects a request with the wrong secret", async () => {
    const response = await apiRequest(
      "/internal/task-occurrences/materialize",
      {
        headers: { Authorization: "Bearer wrong-secret" },
      },
    );
    expect(response.status).toBe(401);
  });

  it("accepts a request with the correct secret and returns a summary", async () => {
    const response = await materialize();
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, number>;
    for (const key of [
      "organizations",
      "processed",
      "created",
      "replaced",
      "deleted",
    ]) {
      expect(typeof body[key]).toBe("number");
    }
  });
});

describe("Task occurrence materialization — configuration writes", () => {
  let world: SeededOrg;

  beforeEach(async () => {
    world = await seedOrganization(db);
    await backdateSeededTemplates(world);
  });

  it("a successful template creation synchronously produces its applicable occurrence, ready for Today", async () => {
    const weekday = getWeekdayFromDate(todayLocal());
    const response = await apiRequest(
      `/locations/${world.locations.main.id}/task-templates`,
      {
        method: "POST",
        actor: asAdmin(world),
        body: JSON.stringify({
          title: "Evening close-down",
          formId: world.forms.cleaning.id,
          weekdays: [weekday],
          scheduledTimes: ["23:59"],
        }),
      },
    );

    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };

    const occurrence = await findOccurrence(created.id, todayLocal(), "23:59");
    expect(occurrence).not.toBeNull();
  });

  it("does not invent a retroactive occurrence for a due time before the template was created", async () => {
    const weekday = getWeekdayFromDate(todayLocal());
    const response = await apiRequest(
      `/locations/${world.locations.main.id}/task-templates`,
      {
        method: "POST",
        actor: asAdmin(world),
        body: JSON.stringify({
          title: "Should skip today",
          formId: world.forms.cleaning.id,
          weekdays: [weekday],
          scheduledTimes: [pastTimeToday()],
        }),
      },
    );

    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };

    const todayOccurrence = await findOccurrence(
      created.id,
      todayLocal(),
      pastTimeToday(),
    );
    expect(todayOccurrence).toBeNull();

    // weekdays is [today's weekday] only, so the next matching slot is 7 days out.
    const nextWeekOccurrence = await findOccurrence(
      created.id,
      addCalendarDays(todayLocal(), 7),
      pastTimeToday(),
    );
    expect(nextWeekOccurrence).not.toBeNull();
  });

  it("archiving a template removes its future unrecorded occurrences, but leaves a protected one", async () => {
    await materialize();
    const before = await findOccurrencesByTemplate(world.templates.cleaning.id);
    expect(before.length).toBeGreaterThan(1);

    // Force one occurrence to already be due, independent of real wall-clock time.
    const protectedRow = before[0]!;
    await db
      .update(taskOccurrences)
      .set({ dueAt: new Date(Date.now() - 60 * 60 * 1000) })
      .where(eq(taskOccurrences.id, protectedRow.id));

    const response = await apiRequest(
      `/locations/${world.locations.main.id}/task-templates/${world.templates.cleaning.id}`,
      { method: "DELETE", actor: asAdmin(world) },
    );
    expect(response.status).toBe(204);

    const after = await findOccurrencesByTemplate(world.templates.cleaning.id);
    expect(after.map((row) => row.id)).toEqual([protectedRow.id]);
  });

  it("a target rename or override change replaces only future unrecorded occurrences", async () => {
    await materialize();

    const protectedRow = await findOccurrence(
      world.templates.temperature.id,
      todayLocal(),
      "08:00",
    );
    const futureDate = addCalendarDays(todayLocal(), 2);
    const futureRowBefore = await findOccurrence(
      world.templates.temperature.id,
      futureDate,
      "08:00",
    );
    expect(protectedRow).not.toBeNull();
    expect(futureRowBefore).not.toBeNull();

    // A record is what locks values in now — an already-open but unrecorded occurrence
    // would otherwise get corrected to the new target name and limits.
    await recordOccurrence(world, protectedRow!);

    const renamed = await apiRequest(
      `/locations/${world.locations.main.id}/targets/${world.targets.fridge.id}`,
      {
        method: "PATCH",
        actor: asAdmin(world),
        body: JSON.stringify({
          name: "Fridge 1 (relabeled)",
          targetTypeId: world.targetTypes.fridge.id,
        }),
      },
    );
    expect(renamed.status).toBe(200);

    const overridden = await apiRequest(
      `/locations/${world.locations.main.id}/task-templates/${world.templates.temperature.id}`,
      {
        method: "PATCH",
        actor: asAdmin(world),
        body: JSON.stringify({
          title: world.templates.temperature.title,
          formId: world.forms.fridgeCheck.id,
          weekdays: [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ],
          scheduledTimes: ["08:00"],
          targets: [
            {
              targetId: world.targets.fridge.id,
              limitOverrides: { [FRIDGE_FIELD_ID]: { min: -2, max: 6 } },
            },
          ],
        }),
      },
    );
    expect(overridden.status).toBe(200);

    const protectedAfter = await findOccurrence(
      world.templates.temperature.id,
      todayLocal(),
      "08:00",
    );
    expect(protectedAfter!.id).toBe(protectedRow!.id);
    expect(protectedAfter!.targetName).toBe("Fridge 1");
    expect(protectedAfter!.resolvedLimits).toEqual({
      [FRIDGE_FIELD_ID]: { min: 0, max: 5 },
    });

    const futureAfter = await findOccurrence(
      world.templates.temperature.id,
      futureDate,
      "08:00",
    );
    expect(futureAfter).not.toBeNull();
    expect(futureAfter!.id).not.toBe(futureRowBefore!.id);
    expect(futureAfter!.targetName).toBe("Fridge 1 (relabeled)");
    expect(futureAfter!.resolvedLimits).toEqual({
      [FRIDGE_FIELD_ID]: { min: -2, max: 6 },
    });
  });

  it("materializes one occurrence per target per slot, with each target's limits", async () => {
    const created = await apiRequest(
      `/locations/${world.locations.main.id}/targets`,
      {
        method: "POST",
        actor: asAdmin(world),
        body: JSON.stringify({
          name: "Fish fridge",
          targetTypeId: world.targetTypes.fridge.id,
        }),
      },
    );
    const fishFridge = (await created.json()) as { id: string };

    const response = await apiRequest(
      `/locations/${world.locations.main.id}/task-templates/${world.templates.temperature.id}`,
      {
        method: "PATCH",
        actor: asAdmin(world),
        body: JSON.stringify({
          title: world.templates.temperature.title,
          formId: world.forms.fridgeCheck.id,
          weekdays: [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ],
          scheduledTimes: ["08:00"],
          targets: [
            { targetId: world.targets.fridge.id },
            {
              targetId: fishFridge.id,
              limitOverrides: { [FRIDGE_FIELD_ID]: { min: 0, max: 2 } },
            },
          ],
        }),
      },
    );
    expect(response.status).toBe(200);

    const futureDate = addCalendarDays(todayLocal(), 2);
    const rows = (
      await findOccurrencesByTemplate(world.templates.temperature.id)
    ).filter((row) => row.occurrenceDate === futureDate);

    expect(
      rows
        .map((row) => ({
          targetName: row.targetName,
          limits: row.resolvedLimits,
        }))
        .sort((a, b) => a.targetName!.localeCompare(b.targetName!)),
    ).toEqual([
      {
        targetName: "Fish fridge",
        limits: { [FRIDGE_FIELD_ID]: { min: 0, max: 2 } },
      },
      {
        targetName: "Fridge 1",
        limits: { [FRIDGE_FIELD_ID]: { min: 0, max: 5 } },
      },
    ]);
  });

  it("archiving a target retires its future unrecorded occurrences", async () => {
    await materialize();
    const futureDate = addCalendarDays(todayLocal(), 2);
    expect(
      await findOccurrence(world.templates.temperature.id, futureDate, "08:00"),
    ).not.toBeNull();

    const response = await apiRequest(
      `/locations/${world.locations.main.id}/targets/${world.targets.fridge.id}`,
      { method: "DELETE", actor: asAdmin(world) },
    );
    expect(response.status).toBe(204);

    const futureRows = (
      await findOccurrencesByTemplate(world.templates.temperature.id)
    ).filter((row) => row.occurrenceDate === futureDate);
    // The template has no targets left, so it falls back to one untargeted check per slot.
    expect(futureRows.map((row) => row.targetId)).toEqual([null]);
  });

  it("a new form version moves future unrecorded occurrences to it and leaves recorded ones", async () => {
    await materialize();

    const protectedRow = await findOccurrence(
      world.templates.cleaning.id,
      todayLocal(),
      "09:00",
    );
    await recordOccurrence(world, protectedRow!);

    const response = await apiRequest(
      `/forms/${world.forms.cleaning.id}/versions`,
      {
        method: "POST",
        actor: asAdmin(world),
        body: JSON.stringify({
          definition: {
            ...CLEANING_DEFINITION,
            fields: [
              ...CLEANING_DEFINITION.fields,
              {
                id: "note",
                type: "text",
                label: "Note",
                required: false,
                multiline: true,
              },
            ],
          },
        }),
      },
    );
    expect(response.status).toBe(201);
    const published = (await response.json()) as {
      latestVersion: { id: string };
    };

    const protectedAfter = await findOccurrence(
      world.templates.cleaning.id,
      todayLocal(),
      "09:00",
    );
    expect(protectedAfter!.formVersionId).toBe(world.forms.cleaning.versionId);

    const futureAfter = await findOccurrence(
      world.templates.cleaning.id,
      addCalendarDays(todayLocal(), 2),
      "09:00",
    );
    expect(futureAfter!.formVersionId).toBe(published.latestVersion.id);
  });

  it("an organization timezone change replaces only future unrecorded occurrences", async () => {
    await materialize();

    const protectedRow = await findOccurrence(
      world.templates.cleaning.id,
      todayLocal(),
      "09:00",
    );
    const futureDate = addCalendarDays(todayLocal(), 2);
    const futureRowBefore = await findOccurrence(
      world.templates.cleaning.id,
      futureDate,
      "09:00",
    );
    expect(protectedRow).not.toBeNull();
    expect(futureRowBefore).not.toBeNull();

    // A record is what locks values in now — an already-open but unrecorded occurrence
    // would otherwise get recomputed under the new timezone.
    await recordOccurrence(world, protectedRow!);

    const response = await apiRequest("/organizations/current", {
      method: "PATCH",
      actor: asAdmin(world),
      body: JSON.stringify({ timezone: "America/New_York" }),
    });
    expect(response.status).toBe(200);

    const protectedAfter = await findOccurrence(
      world.templates.cleaning.id,
      todayLocal(),
      "09:00",
    );
    expect(protectedAfter!.id).toBe(protectedRow!.id);
    expect(protectedAfter!.availableAt.getTime()).toBe(
      protectedRow!.availableAt.getTime(),
    );

    const futureAfter = await findOccurrence(
      world.templates.cleaning.id,
      futureDate,
      "09:00",
    );
    expect(futureAfter).not.toBeNull();
    expect(futureAfter!.id).not.toBe(futureRowBefore!.id);
    expect(futureAfter!.availableAt.getTime()).not.toBe(
      futureRowBefore!.availableAt.getTime(),
    );
  });

  it("stores a template's completion window and snapshots availableAt/dueAt onto new occurrences", async () => {
    const response = await apiRequest(
      `/locations/${world.locations.main.id}/task-templates/${world.templates.cleaning.id}`,
      {
        method: "PATCH",
        actor: asAdmin(world),
        body: cleaningTemplateBody(world, {
          completionOpensBeforeMinutes: 30,
          completionDueAfterMinutes: 60,
        }),
      },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      completionOpensBeforeMinutes: number;
      completionDueAfterMinutes: number | null;
    };
    expect(body.completionOpensBeforeMinutes).toBe(30);
    expect(body.completionDueAfterMinutes).toBe(60);

    const futureDate = addCalendarDays(todayLocal(), 2);
    const occurrence = await findOccurrence(
      world.templates.cleaning.id,
      futureDate,
      "09:00",
    );
    expect(occurrence).not.toBeNull();

    const scheduledInstant = new Date(
      occurrence!.dueAt!.getTime() - 60 * 60 * 1000,
    );
    expect(occurrence!.availableAt.getTime()).toBe(
      scheduledInstant.getTime() - 30 * 60 * 1000,
    );
  });

  it("a Never overdue window is stored as a null dueAt on newly materialized occurrences", async () => {
    const response = await apiRequest(
      `/locations/${world.locations.main.id}/task-templates/${world.templates.cleaning.id}`,
      {
        method: "PATCH",
        actor: asAdmin(world),
        body: cleaningTemplateBody(world, {
          completionOpensBeforeMinutes: 1440,
          completionDueAfterMinutes: null,
        }),
      },
    );
    expect(response.status).toBe(200);

    const futureDate = addCalendarDays(todayLocal(), 2);
    const occurrence = await findOccurrence(
      world.templates.cleaning.id,
      futureDate,
      "09:00",
    );
    expect(occurrence).not.toBeNull();
    expect(occurrence!.dueAt).toBeNull();
  });

  it("a completion window change replaces only unrecorded occurrences", async () => {
    await materialize();

    const protectedRow = await findOccurrence(
      world.templates.cleaning.id,
      todayLocal(),
      "09:00",
    );
    const futureDate = addCalendarDays(todayLocal(), 2);
    const futureRowBefore = await findOccurrence(
      world.templates.cleaning.id,
      futureDate,
      "09:00",
    );
    expect(protectedRow).not.toBeNull();
    expect(futureRowBefore).not.toBeNull();

    // A record is what locks values in now, regardless of whether the window already opened.
    await recordOccurrence(world, protectedRow!);

    const response = await apiRequest(
      `/locations/${world.locations.main.id}/task-templates/${world.templates.cleaning.id}`,
      {
        method: "PATCH",
        actor: asAdmin(world),
        body: cleaningTemplateBody(world, {
          completionOpensBeforeMinutes: 15,
          completionDueAfterMinutes: 30,
        }),
      },
    );
    expect(response.status).toBe(200);

    const protectedAfter = await findOccurrence(
      world.templates.cleaning.id,
      todayLocal(),
      "09:00",
    );
    expect(protectedAfter!.id).toBe(protectedRow!.id);
    expect(protectedAfter!.dueAt!.getTime()).toBe(
      protectedRow!.dueAt!.getTime(),
    );

    const futureAfter = await findOccurrence(
      world.templates.cleaning.id,
      futureDate,
      "09:00",
    );
    expect(futureAfter).not.toBeNull();
    expect(futureAfter!.id).not.toBe(futureRowBefore!.id);
    expect(futureAfter!.availableAt.getTime()).not.toBe(
      futureRowBefore!.availableAt.getTime(),
    );
  });

  it("corrects an already-open, unrecorded occurrence's window when the template narrows it", async () => {
    // Regression for a stale-window bug: the default (1440-minute) window opens at the start
    // of the local day, so today's occurrence is already "open" by the time an admin narrows
    // the window same-day. With no record on it yet, the narrower window must still apply —
    // it must not stay frozen at the wide window it happened to materialize under.
    await materialize();

    const beforeRow = await findOccurrence(
      world.templates.cleaning.id,
      todayLocal(),
      "09:00",
    );
    expect(beforeRow).not.toBeNull();
    expect(beforeRow!.availableAt.getTime()).toBeLessThanOrEqual(Date.now());

    const response = await apiRequest(
      `/locations/${world.locations.main.id}/task-templates/${world.templates.cleaning.id}`,
      {
        method: "PATCH",
        actor: asAdmin(world),
        body: cleaningTemplateBody(world, {
          completionOpensBeforeMinutes: 15,
          completionDueAfterMinutes: 30,
        }),
      },
    );
    expect(response.status).toBe(200);

    const afterRow = await findOccurrence(
      world.templates.cleaning.id,
      todayLocal(),
      "09:00",
    );
    expect(afterRow).not.toBeNull();
    expect(afterRow!.id).not.toBe(beforeRow!.id);
    expect(afterRow!.availableAt.getTime()).not.toBe(
      beforeRow!.availableAt.getTime(),
    );
  });

  it("leaves a recorded occurrence — including a voided one — unchanged despite a stale slot", async () => {
    await materialize();

    const futureDate = addCalendarDays(todayLocal(), 2);
    const recordedRow = await findOccurrence(
      world.templates.cleaning.id,
      futureDate,
      "09:00",
    );
    const voidedDate = addCalendarDays(todayLocal(), 3);
    const voidedRow = await findOccurrence(
      world.templates.cleaning.id,
      voidedDate,
      "09:00",
    );
    expect(recordedRow).not.toBeNull();
    expect(voidedRow).not.toBeNull();

    await recordOccurrence(world, recordedRow!);
    await recordOccurrence(world, voidedRow!, { voided: true });

    const response = await apiRequest(
      `/locations/${world.locations.main.id}/task-templates/${world.templates.cleaning.id}`,
      {
        method: "PATCH",
        actor: asAdmin(world),
        body: cleaningTemplateBody(world, { title: "Renamed cleaning check" }),
      },
    );
    expect(response.status).toBe(200);

    const recordedAfter = await findOccurrence(
      world.templates.cleaning.id,
      futureDate,
      "09:00",
    );
    const voidedAfter = await findOccurrence(
      world.templates.cleaning.id,
      voidedDate,
      "09:00",
    );

    expect(recordedAfter!.id).toBe(recordedRow!.id);
    expect(recordedAfter!.title).toBe("Clean prep surface");
    expect(voidedAfter!.id).toBe(voidedRow!.id);
    expect(voidedAfter!.title).toBe("Clean prep surface");
  });
});
