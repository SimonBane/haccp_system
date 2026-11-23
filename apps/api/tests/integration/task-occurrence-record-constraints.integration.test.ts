import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  locations,
  organizations,
  taskOccurrences,
  taskRecordReadings,
  taskRecords,
  users,
} from "../../src/core/db/schema/index.js";
import { PG_ERROR, postgresErrorCode } from "./harness/db.js";
import { seedTwoTenants, type TwoTenantWorld } from "./harness/fixtures.js";

/** The occurrence and record tables enforce their invariants at the database boundary. */
describe("task occurrence and record constraints", () => {
  let world: TwoTenantWorld;

  beforeEach(async () => {
    world = await seedTwoTenants(db);
  });

  async function codeFor(operation: Promise<unknown>): Promise<string | null> {
    try {
      await operation;
      return null;
    } catch (error) {
      return postgresErrorCode(error);
    }
  }

  function occurrenceValues(overrides: {
    locationId: string;
    taskTemplateId: string;
    occurrenceDate?: string;
    scheduledTime?: string;
  }) {
    return {
      locationId: overrides.locationId,
      taskTemplateId: overrides.taskTemplateId,
      occurrenceDate: overrides.occurrenceDate ?? "2026-08-19",
      scheduledTime: overrides.scheduledTime ?? "08:00",
      availableAt: new Date("2026-08-19T00:00:00Z"),
      dueAt: new Date("2026-08-19T08:00:00Z"),
      title: "Morning fridge check",
      formVersionId: world.alpha.forms.fridgeCheck.versionId,
    };
  }

  function recordValues(
    occurrenceId: string | null,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      locationId: world.alpha.locations.main.id,
      // A scheduled record carries its task; an on-demand one carries neither.
      taskTemplateId:
        occurrenceId === null ? null : world.alpha.templates.temperature.id,
      occurrenceId,
      title: "Morning fridge check",
      formVersionId: world.alpha.forms.fridgeCheck.versionId,
      entryDate: "2026-08-19",
      entryTime: "08:00",
      values: {},
      result: "pass",
      createdByUserId: world.alpha.admin.userId,
      recordedAt: new Date(),
      recordedByUserId: world.alpha.admin.userId,
      ...overrides,
    };
  }

  it("allows one untargeted occurrence per template/date/time", async () => {
    const code = await codeFor(
      db.insert(taskOccurrences).values(
        occurrenceValues({
          locationId: world.alpha.locations.main.id,
          taskTemplateId: world.alpha.templates.temperature.id,
        }),
      ),
    );

    expect(code).toBeNull();
  });

  it("refuses a second untargeted occurrence for the same template/date/time", async () => {
    await db.insert(taskOccurrences).values(
      occurrenceValues({
        locationId: world.alpha.locations.main.id,
        taskTemplateId: world.alpha.templates.temperature.id,
      }),
    );

    const code = await codeFor(
      db.insert(taskOccurrences).values(
        occurrenceValues({
          locationId: world.alpha.locations.main.id,
          taskTemplateId: world.alpha.templates.temperature.id,
        }),
      ),
    );

    expect(code).toBe(PG_ERROR.UNIQUE_VIOLATION);
  });

  it("refuses an occurrence whose template belongs to another location", async () => {
    // world.alpha.templates.temperature belongs to `main`, not `annex`.
    const code = await codeFor(
      db.insert(taskOccurrences).values(
        occurrenceValues({
          locationId: world.alpha.locations.annex.id,
          taskTemplateId: world.alpha.templates.temperature.id,
        }),
      ),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("refuses an occurrence whose template belongs to another organization", async () => {
    const code = await codeFor(
      db.insert(taskOccurrences).values(
        occurrenceValues({
          locationId: world.alpha.locations.main.id,
          taskTemplateId: world.beta.templates.temperature.id,
        }),
      ),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  async function insertOccurrence(): Promise<string> {
    const [occurrence] = await db
      .insert(taskOccurrences)
      .values(
        occurrenceValues({
          locationId: world.alpha.locations.main.id,
          taskTemplateId: world.alpha.templates.temperature.id,
        }),
      )
      .returning({ id: taskOccurrences.id });

    return occurrence!.id;
  }

  it("allows one record per occurrence", async () => {
    const occurrenceId = await insertOccurrence();

    const code = await codeFor(
      db.insert(taskRecords).values(recordValues(occurrenceId)),
    );

    expect(code).toBeNull();
  });

  it("refuses a second record for the same occurrence", async () => {
    const occurrenceId = await insertOccurrence();
    const values = recordValues(occurrenceId);

    await db.insert(taskRecords).values(values);

    const code = await codeFor(db.insert(taskRecords).values(values));

    expect(code).toBe(PG_ERROR.UNIQUE_VIOLATION);
  });

  it("refuses a record that references a missing occurrence", async () => {
    const code = await codeFor(
      db
        .insert(taskRecords)
        .values(recordValues("00000000-0000-4000-8000-000000000000")),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("allows any number of records without an occurrence", async () => {
    await db.insert(taskRecords).values(recordValues(null));

    expect(
      await codeFor(db.insert(taskRecords).values(recordValues(null))),
    ).toBeNull();
  });

  it("refuses a record whose occurrence belongs to another location", async () => {
    const occurrenceId = await insertOccurrence();

    const code = await codeFor(
      db.insert(taskRecords).values(
        recordValues(occurrenceId, {
          locationId: world.alpha.locations.annex.id,
        }),
      ),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("refuses a record whose template belongs to another organization", async () => {
    const occurrenceId = await insertOccurrence();

    const code = await codeFor(
      db.insert(taskRecords).values(
        recordValues(occurrenceId, {
          taskTemplateId: world.beta.templates.temperature.id,
        }),
      ),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("refuses an occurrence without its task, or a task without an occurrence", async () => {
    const occurrenceId = await insertOccurrence();

    expect(
      await codeFor(
        db
          .insert(taskRecords)
          .values(recordValues(occurrenceId, { taskTemplateId: null })),
      ),
    ).toBe(PG_ERROR.CHECK_VIOLATION);
    expect(
      await codeFor(
        db.insert(taskRecords).values(
          recordValues(null, {
            taskTemplateId: world.alpha.templates.temperature.id,
          }),
        ),
      ),
    ).toBe(PG_ERROR.CHECK_VIOLATION);
  });

  it("refuses a record whose target belongs to another organization", async () => {
    const code = await codeFor(
      db.insert(taskRecords).values(
        recordValues(null, { targetId: world.beta.targets.fridge.id }),
      ),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("resolves a record's organization through its own location", async () => {
    const [record] = await db
      .insert(taskRecords)
      .values(recordValues(null))
      .returning({ id: taskRecords.id });

    const [row] = await db
      .select({ organizationId: organizations.id })
      .from(taskRecords)
      .innerJoin(locations, eq(taskRecords.locationId, locations.id))
      .innerJoin(organizations, eq(locations.organizationId, organizations.id))
      .where(eq(taskRecords.id, record!.id));

    expect(row?.organizationId).toBe(world.alpha.organizationId);
  });

  async function insertRecord(): Promise<string> {
    const occurrenceId = await insertOccurrence();
    const [record] = await db
      .insert(taskRecords)
      .values(recordValues(occurrenceId))
      .returning({ id: taskRecords.id });
    return record!.id;
  }

  function readingValues(
    taskRecordId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      taskRecordId,
      fieldId: "temperature",
      locationId: world.alpha.locations.main.id,
      targetId: world.alpha.targets.fridge.id,
      unit: "celsius",
      value: "3.0",
      minValue: "0.0",
      maxValue: "5.0",
      fails: false,
      recordedAt: new Date(),
      ...overrides,
    };
  }

  it("keeps one reading per record and field", async () => {
    const recordId = await insertRecord();

    expect(
      await codeFor(
        db.insert(taskRecordReadings).values(readingValues(recordId)),
      ),
    ).toBeNull();
    expect(
      await codeFor(
        db.insert(taskRecordReadings).values(readingValues(recordId)),
      ),
    ).toBe(PG_ERROR.UNIQUE_VIOLATION);
    expect(
      await codeFor(
        db
          .insert(taskRecordReadings)
          .values(readingValues(recordId, { fieldId: "core_temperature" })),
      ),
    ).toBeNull();
  });

  it("refuses a reading for a missing task record", async () => {
    const code = await codeFor(
      db
        .insert(taskRecordReadings)
        .values(readingValues("00000000-0000-4000-8000-000000000000")),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("refuses a reading whose target belongs to another location", async () => {
    const recordId = await insertRecord();

    const code = await codeFor(
      db
        .insert(taskRecordReadings)
        .values(
          readingValues(recordId, {
            locationId: world.alpha.locations.annex.id,
          }),
        ),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("refuses a record whose form version does not exist", async () => {
    const occurrenceId = await insertOccurrence();

    const code = await codeFor(
      db.insert(taskRecords).values({
        ...recordValues(occurrenceId),
        formVersionId: "00000000-0000-4000-8000-000000000000",
      }),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("keeps user relationships on task_records restrictive", async () => {
    const occurrenceId = await insertOccurrence();
    await db.insert(taskRecords).values(recordValues(occurrenceId));

    const code = await codeFor(
      db.delete(users).where(eq(users.id, world.alpha.admin.userId)),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });
});
