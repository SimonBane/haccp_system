import { zonedDateString } from "@haccp/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  seedOccurrence,
  seedOrganization,
  type SeededOrg,
} from "./harness/fixtures.js";
import { apiRequest, asAdmin, asEmployee } from "./harness/request.js";

/** Today writes use occurrenceId; the org timezone still gates future dates (HACCP-59). */
describe("Today write guardrails", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "today-guardrails" });
  });

  function today(): string {
    return zonedDateString(new Date(), org.timeZone);
  }

  function tomorrow(): string {
    const [year, month, day] = today().split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1, day));
    next.setUTCDate(next.getUTCDate() + 1);
    return zonedDateString(next, "UTC");
  }

  function recordPath(locationId: string, occurrenceId: string): string {
    return `/locations/${locationId}/today/occurrences/${occurrenceId}/record`;
  }

  it("does not accept template/date/time as write identity", async () => {
    const tupleBody = JSON.stringify({
      templateId: org.templates.cleaning.id,
      date: today(),
      scheduledTime: "09:00",
    });

    for (const suffix of ["complete", "complete-temperature", "uncomplete"]) {
      const path = `/locations/${org.locations.main.id}/today/${suffix}`;

      const employee = await apiRequest(path, {
        method: "POST",
        actor: asEmployee(org),
        body: tupleBody,
      });
      const admin = await apiRequest(path, {
        method: "POST",
        actor: asAdmin(org),
        body: tupleBody,
      });

      expect(employee.ok).toBe(false);
      expect(admin.ok).toBe(false);
    }
  });

  it("rejects a record write for a future occurrence date", async () => {
    const occurrenceId = await seedOccurrence(db, org, {
      type: "cleaning",
      occurrenceDate: tomorrow(),
      scheduledTime: "09:00",
    });

    const response = await apiRequest(
      recordPath(org.locations.main.id, occurrenceId),
      {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify({ kind: "ordinary" }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("rejects a temperature write for a future occurrence date", async () => {
    const occurrenceId = await seedOccurrence(db, org, {
      type: "temperature",
      occurrenceDate: tomorrow(),
      scheduledTime: "08:00",
    });

    const response = await apiRequest(
      recordPath(org.locations.main.id, occurrenceId),
      {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify({ kind: "temperature", recordedC: 3 }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("accepts a record write for the organization's current business date", async () => {
    const occurrenceId = await seedOccurrence(db, org, {
      type: "cleaning",
      occurrenceDate: today(),
      scheduledTime: "09:00",
    });

    const response = await apiRequest(
      recordPath(org.locations.main.id, occurrenceId),
      {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify({ kind: "ordinary" }),
      },
    );

    expect(response.status).toBe(201);
  });
});
