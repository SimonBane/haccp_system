import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  locations,
  organizationMemberLocations,
  targets,
  taskOccurrences,
  taskRecords,
  taskTemplateTargets,
  users,
} from "../../src/core/db/schema/index.js";
import { PG_ERROR, postgresErrorCode } from "./harness/db.js";
import {
  seedOccurrence,
  seedTwoTenants,
  type TwoTenantWorld,
} from "./harness/fixtures.js";

/**
 * Invariants the database enforces without application code, so a service bug or a
 * direct query still cannot produce a cross-tenant row. SQLSTATE, not message text.
 */
describe("database constraints", () => {
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

  it("refuses to assign a membership to another organization's location", async () => {
    // The composite (location_id, organization_id) FK: the pair must exist together.
    const code = await codeFor(
      db.insert(organizationMemberLocations).values({
        membershipId: world.alpha.employee.membershipId,
        locationId: world.beta.locations.main.id,
        organizationId: world.alpha.organizationId,
      }),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("allows the same assignment within one organization", async () => {
    const code = await codeFor(
      db.insert(organizationMemberLocations).values({
        membershipId: world.alpha.employee.membershipId,
        locationId: world.alpha.locations.annex.id,
        organizationId: world.alpha.organizationId,
      }),
    );

    expect(code).toBeNull();
  });

  it("permits only one default location per organization", async () => {
    const code = await codeFor(
      db.insert(locations).values({
        organizationId: world.alpha.organizationId,
        name: "Second default",
        isDefault: true,
      }),
    );

    expect(code).toBe(PG_ERROR.UNIQUE_VIOLATION);
  });

  it("lets a second organization have its own default location", async () => {
    // The partial unique index is per organization, not global.
    const [alphaDefaults, betaDefaults] = await Promise.all([
      db.query.locations.findMany({
        where: (row, { and, eq }) =>
          and(
            eq(row.organizationId, world.alpha.organizationId),
            eq(row.isDefault, true),
          ),
      }),
      db.query.locations.findMany({
        where: (row, { and, eq }) =>
          and(
            eq(row.organizationId, world.beta.organizationId),
            eq(row.isDefault, true),
          ),
      }),
    ]);

    expect(alphaDefaults).toHaveLength(1);
    expect(betaDefaults).toHaveLength(1);
  });

  it("rejects duplicate active target names within a location but not across locations", async () => {
    const duplicate = await codeFor(
      db.insert(targets).values({
        locationId: world.alpha.locations.main.id,
        targetTypeId: world.alpha.targetTypes.fridge.id,
        name: world.alpha.targets.fridge.name,
      }),
    );

    expect(duplicate).toBe(PG_ERROR.UNIQUE_VIOLATION);

    const sameNameElsewhere = await codeFor(
      db.insert(targets).values({
        locationId: world.alpha.locations.annex.id,
        targetTypeId: world.alpha.targetTypes.fridge.id,
        name: world.alpha.targets.fridge.name,
      }),
    );

    expect(sameNameElsewhere).toBeNull();
  });

  it("frees an archived target's name for a new one", async () => {
    await db
      .update(targets)
      .set({ archivedAt: new Date() })
      .where(sql`${targets.id} = ${world.alpha.targets.fridge.id}`);

    const code = await codeFor(
      db.insert(targets).values({
        locationId: world.alpha.locations.main.id,
        targetTypeId: world.alpha.targetTypes.fridge.id,
        name: world.alpha.targets.fridge.name,
      }),
    );

    expect(code).toBeNull();
  });

  it("refuses a target as its own parent", async () => {
    const code = await codeFor(
      db
        .update(targets)
        .set({ parentId: world.alpha.targets.fridge.id })
        .where(sql`${targets.id} = ${world.alpha.targets.fridge.id}`),
    );

    expect(code).toBe(PG_ERROR.CHECK_VIOLATION);
  });

  it("refuses a parent target from another location", async () => {
    const code = await codeFor(
      db.insert(targets).values({
        locationId: world.alpha.locations.annex.id,
        targetTypeId: world.alpha.targetTypes.fridge.id,
        name: "Annex shelf",
        parentId: world.alpha.targets.fridge.id,
      }),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("refuses to link a template to a target from another location in the same org", async () => {
    // Composite (target_id, location_id) and (task_template_id, location_id) FKs pin both to one location.
    const asTargetsLocation = await codeFor(
      db.insert(taskTemplateTargets).values({
        taskTemplateId: world.alpha.templates.cleaning.id,
        targetId: world.alpha.targets.fridge.id,
        locationId: world.alpha.locations.annex.id,
      }),
    );
    expect(asTargetsLocation).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("refuses to link a template to a target from another organization", async () => {
    const code = await codeFor(
      db.insert(taskTemplateTargets).values({
        taskTemplateId: world.alpha.templates.cleaning.id,
        targetId: world.beta.targets.fridge.id,
        locationId: world.alpha.locations.main.id,
      }),
    );

    expect(code).toBe(PG_ERROR.FOREIGN_KEY_VIOLATION);
  });

  it("accepts a template's target from its own location", async () => {
    const code = await codeFor(
      db.insert(taskTemplateTargets).values({
        taskTemplateId: world.alpha.templates.cleaning.id,
        targetId: world.alpha.targets.fridge.id,
        locationId: world.alpha.locations.main.id,
      }),
    );

    expect(code).toBeNull();
  });

  it("keeps one untargeted occurrence per template and slot", async () => {
    await seedOccurrence(db, world.alpha, {
      type: "cleaning",
      occurrenceDate: "2026-03-02",
    });

    const code = await codeFor(
      seedOccurrence(db, world.alpha, {
        type: "cleaning",
        occurrenceDate: "2026-03-02",
      }),
    );

    expect(code).toBe(PG_ERROR.UNIQUE_VIOLATION);
  });

  it("allows one occurrence per target in the same slot", async () => {
    await seedOccurrence(db, world.alpha, {
      type: "temperature",
      occurrenceDate: "2026-03-02",
    });
    const [second] = await db
      .insert(targets)
      .values({
        locationId: world.alpha.locations.main.id,
        targetTypeId: world.alpha.targetTypes.fridge.id,
        name: "Fridge 2",
      })
      .returning();

    const code = await codeFor(
      db.insert(taskOccurrences).values({
        locationId: world.alpha.locations.main.id,
        taskTemplateId: world.alpha.templates.temperature.id,
        occurrenceDate: "2026-03-02",
        scheduledTime: "08:00",
        availableAt: new Date("2026-03-02T00:00:00Z"),
        title: world.alpha.templates.temperature.title,
        formVersionId: world.alpha.forms.fridgeCheck.versionId,
        targetId: second!.id,
        targetName: second!.name,
      }),
    );

    expect(code).toBeNull();
  });

  it("refuses an unknown record result", async () => {
    const occurrenceId = await seedOccurrence(db, world.alpha, {
      type: "cleaning",
      occurrenceDate: "2026-03-02",
    });

    const code = await codeFor(
      db.insert(taskRecords).values({
        occurrenceId,
        formVersionId: world.alpha.forms.cleaning.versionId,
        values: {},
        result: "ok",
        createdByUserId: world.alpha.admin.userId,
        recordedAt: new Date(),
        recordedByUserId: world.alpha.admin.userId,
      }),
    );

    expect(code).toBe(PG_ERROR.CHECK_VIOLATION);
  });

  it("treats user email as globally unique, not per tenant", async () => {
    // lower(email) with no organization column: one person cannot be two user rows.
    const code = await codeFor(
      db.insert(users).values({
        clerkUserId: `user_conflict_${Date.now()}`,
        firstName: "Same",
        lastName: "Address",
        email: world.alpha.employee.email.toUpperCase(),
      }),
    );

    expect(code).toBe(PG_ERROR.UNIQUE_VIOLATION);
  });

  it("no longer has the retired equipment and temperature tables", async () => {
    const tables = (
      await db.execute<{ tablename: string }>(
        sql`select tablename from pg_tables where schemaname = 'public'`,
      )
    ).map((row) => row.tablename);

    expect(tables).not.toContain("task_completions");
    expect(tables).not.toContain("temperature_logs");
    expect(tables).not.toContain("equipment");
    expect(tables).not.toContain("task_record_temperatures");
    expect(tables).toContain("targets");
    expect(tables).toContain("form_versions");
    expect(tables).toContain("task_record_readings");
    expect(tables).toContain("task_occurrences");
    expect(tables).toContain("task_records");
    expect(tables).toContain("task_templates");
  });
});
