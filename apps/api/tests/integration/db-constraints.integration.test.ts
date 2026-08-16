import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  equipment,
  locations,
  organizationMemberLocations,
  users,
} from "../../src/core/db/schema/index.js";
import { PG_ERROR, postgresErrorCode } from "./harness/db.js";
import { seedTwoTenants, type TwoTenantWorld } from "./harness/fixtures.js";

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

  it("rejects equipment whose minimum temperature is not below its maximum", async () => {
    const code = await codeFor(
      db.insert(equipment).values({
        locationId: world.alpha.locations.main.id,
        name: "Broken range",
        type: "fridge",
        minTempC: "8.0",
        maxTempC: "4.0",
      }),
    );

    expect(code).toBe(PG_ERROR.CHECK_VIOLATION);
  });

  it("rejects duplicate equipment names within a location but not across locations", async () => {
    const duplicate = await codeFor(
      db.insert(equipment).values({
        locationId: world.alpha.locations.main.id,
        name: world.alpha.equipment.fridge.name,
        type: "fridge",
        minTempC: "0.0",
        maxTempC: "5.0",
      }),
    );

    expect(duplicate).toBe(PG_ERROR.UNIQUE_VIOLATION);

    const sameNameElsewhere = await codeFor(
      db.insert(equipment).values({
        locationId: world.alpha.locations.annex.id,
        name: world.alpha.equipment.fridge.name,
        type: "fridge",
        minTempC: "0.0",
        maxTempC: "5.0",
      }),
    );

    expect(sameNameElsewhere).toBeNull();
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
});
