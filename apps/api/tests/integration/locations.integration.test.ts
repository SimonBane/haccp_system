import { locationResponseSchema } from "@haccp/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { seedOrganization, type SeededOrg } from "./harness/fixtures.js";
import { apiRequest, asAdmin } from "./harness/request.js";

describe("Locations", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "locations" });
  });

  it("creates and renames a location", async () => {
    const createdResponse = await apiRequest("/locations", {
      method: "POST",
      actor: asAdmin(org),
      body: JSON.stringify({ name: "Bakery" }),
    });

    expect(createdResponse.status).toBe(201);
    const created = locationResponseSchema.parse(await createdResponse.json());
    expect(created.name).toBe("Bakery");
    expect(created.organizationId).toBe(org.organizationId);
    expect(created.isDefault).toBe(false);

    const renamedResponse = await apiRequest(`/locations/${created.id}`, {
      method: "PATCH",
      actor: asAdmin(org),
      body: JSON.stringify({ name: "Pastry" }),
    });

    expect(renamedResponse.status).toBe(200);
    const renamed = locationResponseSchema.parse(await renamedResponse.json());
    expect(renamed.id).toBe(created.id);
    expect(renamed.name).toBe("Pastry");
  });
});
