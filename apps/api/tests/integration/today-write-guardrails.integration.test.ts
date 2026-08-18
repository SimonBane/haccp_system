import { zonedDateString } from "@haccp/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { seedOrganization, type SeededOrg } from "./harness/fixtures.js";
import { apiRequest, asEmployee } from "./harness/request.js";

/**
 * HACCP-59: the Today write endpoints must reject a completion/temperature
 * write for a date after the organization's current business date, computed
 * from the org's own timezone rather than trusting the client-supplied date.
 */
describe("Today write guardrails", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "today-guardrails" });
  });

  function tomorrow(): string {
    const today = zonedDateString(new Date(), org.timeZone);
    const [year, month, day] = today.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day));
    next.setUTCDate(next.getUTCDate() + 1);
    return zonedDateString(next, "UTC");
  }

  it("rejects a completion write for a future date", async () => {
    const response = await apiRequest(
      `/locations/${org.locations.main.id}/today/complete`,
      {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify({
          templateId: org.templates.cleaning.id,
          date: tomorrow(),
          scheduledTime: "09:00",
        }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("rejects a temperature write for a future date", async () => {
    const response = await apiRequest(
      `/locations/${org.locations.main.id}/today/complete-temperature`,
      {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify({
          templateId: org.templates.temperature.id,
          date: tomorrow(),
          scheduledTime: "08:00",
          recordedC: 3,
        }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("accepts a completion write for the organization's current business date", async () => {
    const today = zonedDateString(new Date(), org.timeZone);

    const response = await apiRequest(
      `/locations/${org.locations.main.id}/today/complete`,
      {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify({
          templateId: org.templates.cleaning.id,
          date: today,
          scheduledTime: "09:00",
        }),
      },
    );

    expect(response.status).toBe(200);
  });
});
