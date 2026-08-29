import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  locations,
  organizations,
  taskOccurrences,
  taskRecords,
  taskRecordTemperatures,
  users,
} from "../../src/core/db/schema/index.js";
import { PG_ERROR, postgresErrorCode } from "./harness/db.js";
import { seedTwoTenants, type TwoTenantWorld } from "./harness/fixtures.js";

/**
 * M0.1: the normalized occurrence/record tables enforce their invariants at the
 * database boundary, independent of the (not-yet-built) generation/record services.
 */
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
      type: "temperature",
    };
  }

  it("allows one occurrence per template/date/time", async () => {
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

  it("refuses a second occurrence for the same template/date/time", async () => {
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
    const now = new Date();

    const code = await codeFor(
      db.insert(taskRecords).values({
        occurrenceId,
        createdByUserId: world.alpha.admin.userId,
        recordedAt: now,
        recordedByUserId: world.alpha.admin.userId,
      }),
    );

    expect(code).toBeNull();
  });

  it("refuses a second record for the same occurrence", async () => {
    const occurrenceId = await insertOccurrence();
    const now = new Date();
    const values = {
      occurrenceId,
      createdByUserId: world.alpha.admin.userId,
      recordedAt: now,
      recordedByUserId: world.alpha.admin.userId,
    };

    await db.insert(taskRecords).values(values);

    const code = await codeFor(db.insert(taskRecords).values(values));

    expect(code).toBe(PG_ERROR.UNIQUE_VIOLATION);
  });

  it("refuses a record that references a missing occurrence", async () => {
    const now = new Date();

    const code = await codeFor(
      db.insert(taskRecords).values({
        occurrenceId: "00000000-0000-4000-8000-000000000000",
        createdByUserId: world.alpha.admin.userId,
        recordedAt: now,
        recordedByUserId: world.alpha.admin.userId,
      }),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("resolves a record's location and organization through its occurrence", async () => {
    const occurrenceId = await insertOccurrence();
    const now = new Date();
    const [record] = await db
      .insert(taskRecords)
      .values({
        occurrenceId,
        createdByUserId: world.alpha.admin.userId,
        recordedAt: now,
        recordedByUserId: world.alpha.admin.userId,
      })
      .returning({ id: taskRecords.id });

    const [row] = await db
      .select({
        locationId: locations.id,
        organizationId: organizations.id,
      })
      .from(taskRecords)
      .innerJoin(taskOccurrences, eq(taskRecords.occurrenceId, taskOccurrences.id))
      .innerJoin(locations, eq(taskOccurrences.locationId, locations.id))
      .innerJoin(organizations, eq(locations.organizationId, organizations.id))
      .where(eq(taskRecords.id, record!.id));

    expect(row?.locationId).toBe(world.alpha.locations.main.id);
    expect(row?.organizationId).toBe(world.alpha.organizationId);
  });

  it("keeps temperature detail one-to-one with its task record", async () => {
    const occurrenceId = await insertOccurrence();
    const now = new Date();
    const [record] = await db
      .insert(taskRecords)
      .values({
        occurrenceId,
        createdByUserId: world.alpha.admin.userId,
        recordedAt: now,
        recordedByUserId: world.alpha.admin.userId,
      })
      .returning({ id: taskRecords.id });

    const detailValues = {
      taskRecordId: record!.id,
      recordedC: "3.0",
      minTempC: "0.0",
      maxTempC: "5.0",
      result: "ok",
    };

    const first = await codeFor(
      db.insert(taskRecordTemperatures).values(detailValues),
    );
    expect(first).toBeNull();

    const second = await codeFor(
      db.insert(taskRecordTemperatures).values(detailValues),
    );
    expect(second).toBe(PG_ERROR.UNIQUE_VIOLATION);
  });

  it("refuses a temperature detail for a missing task record", async () => {
    const code = await codeFor(
      db.insert(taskRecordTemperatures).values({
        taskRecordId: "00000000-0000-4000-8000-000000000000",
        recordedC: "3.0",
        minTempC: "0.0",
        maxTempC: "5.0",
        result: "ok",
      }),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("keeps user relationships on task_records restrictive", async () => {
    const occurrenceId = await insertOccurrence();
    const now = new Date();
    await db.insert(taskRecords).values({
      occurrenceId,
      createdByUserId: world.alpha.admin.userId,
      recordedAt: now,
      recordedByUserId: world.alpha.admin.userId,
    });

    const code = await codeFor(
      db.delete(users).where(eq(users.id, world.alpha.admin.userId)),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });
});
