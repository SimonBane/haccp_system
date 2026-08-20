import {
  addCalendarDays,
  taskRecordResponseSchema,
  zonedDateString,
} from "@haccp/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  taskOccurrences,
  taskRecords,
  taskRecordTemperatures,
} from "../../src/core/db/schema/index.js";
import {
  seedOrganization,
  seedTwoTenants,
  type SeededOrg,
  type TwoTenantWorld,
} from "./harness/fixtures.js";
import { apiRequest, asAdmin, asEmployee } from "./harness/request.js";

/**
 * HACCP-13: the task-records service owns first submission, edit/reactivation
 * and soft void (Undo) for the single current record attached to an occurrence.
 */
describe("Task record writes", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "task-records" });
  });

  function today(): string {
    return zonedDateString(new Date(), org.timeZone);
  }

  async function insertOccurrence(overrides: {
    type: "temperature" | "cleaning";
    occurrenceDate?: string;
    locationId?: string;
    equipmentId?: string | null;
    minTempC?: string | null;
    maxTempC?: string | null;
  }): Promise<string> {
    const locationId = overrides.locationId ?? org.locations.main.id;
    const taskTemplateId =
      overrides.type === "temperature"
        ? org.templates.temperature.id
        : org.templates.cleaning.id;
    const occurrenceDate = overrides.occurrenceDate ?? today();

    const [row] = await db
      .insert(taskOccurrences)
      .values({
        locationId,
        taskTemplateId,
        occurrenceDate,
        scheduledTime: "08:00",
        dueAt: new Date(`${occurrenceDate}T08:00:00Z`),
        title: "Test occurrence",
        type: overrides.type,
        equipmentId:
          overrides.type === "temperature"
            ? (overrides.equipmentId ?? org.equipment.fridge.id)
            : null,
        equipmentName: overrides.type === "temperature" ? "Fridge 1" : null,
        minTempC:
          overrides.type === "temperature"
            ? (overrides.minTempC ?? "0.0")
            : null,
        maxTempC:
          overrides.type === "temperature"
            ? (overrides.maxTempC ?? "5.0")
            : null,
      })
      .returning({ id: taskOccurrences.id });

    return row!.id;
  }

  function recordPath(locationId: string, occurrenceId: string): string {
    return `/locations/${locationId}/today/occurrences/${occurrenceId}/record`;
  }

  describe("POST — first submission", () => {
    it("submits an ordinary record", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify({ kind: "ordinary" }),
        },
      );

      expect(response.status).toBe(201);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body).toMatchObject({
        occurrenceId,
        active: true,
        recordedByUserId: org.employee.userId,
        createdByUserId: org.employee.userId,
        voidedAt: null,
        voidedByUserId: null,
        temperature: null,
      });
    });

    it("submits a passing temperature record", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify({ kind: "temperature", recordedC: 3 }),
        },
      );

      expect(response.status).toBe(201);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body.temperature).toEqual({
        recordedC: 3,
        minTempC: 0,
        maxTempC: 5,
        result: "ok",
        correctiveAction: null,
      });
    });

    it("rejects a failing temperature reading with no corrective action", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify({ kind: "temperature", recordedC: 12 }),
        },
      );

      expect(response.status).toBe(400);

      const rows = await db
        .select()
        .from(taskRecords)
        .where(eq(taskRecords.occurrenceId, occurrenceId));
      expect(rows).toHaveLength(0);
    });

    it("accepts a failing temperature reading with a corrective action", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify({
            kind: "temperature",
            recordedC: 12,
            correctiveAction: "Moved stock to backup fridge",
          }),
        },
      );

      expect(response.status).toBe(201);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body.temperature).toEqual({
        recordedC: 12,
        minTempC: 0,
        maxTempC: 5,
        result: "out_of_range",
        correctiveAction: "Moved stock to backup fridge",
      });
    });

    it("rejects a reading outside the -99.9..99.9 technical bound", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify({ kind: "temperature", recordedC: 150 }),
        },
      );

      expect(response.status).toBe(400);
    });

    it("rejects a temperature payload against a cleaning occurrence", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });

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

    it("rejects an ordinary payload against a temperature occurrence", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });

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

    it("409s a duplicate submission without overwriting the original", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });

      const first = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify({ kind: "ordinary" }),
        },
      );
      expect(first.status).toBe(201);
      const firstBody = taskRecordResponseSchema.parse(await first.json());

      const second = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asAdmin(org),
          body: JSON.stringify({ kind: "ordinary" }),
        },
      );
      expect(second.status).toBe(409);

      const rows = await db
        .select()
        .from(taskRecords)
        .where(eq(taskRecords.occurrenceId, occurrenceId));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe(firstBody.id);
      expect(rows[0]!.recordedByUserId).toBe(org.employee.userId);
    });

    it("rejects an occurrence dated after the organization's current local date", async () => {
      const occurrenceId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: addCalendarDays(today(), 1),
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

    it("accepts an occurrence dated before the organization's current local date", async () => {
      const occurrenceId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: addCalendarDays(today(), -3),
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

  describe("PUT — edit and reactivate", () => {
    it("404s when there is no record yet for the occurrence", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "PUT",
          actor: asEmployee(org),
          body: JSON.stringify({ kind: "ordinary" }),
        },
      );

      expect(response.status).toBe(404);
    });

    it("replaces the current temperature detail and attribution on an active record", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });
      await apiRequest(recordPath(org.locations.main.id, occurrenceId), {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify({ kind: "temperature", recordedC: 3 }),
      });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "PUT",
          actor: asAdmin(org),
          body: JSON.stringify({
            kind: "temperature",
            recordedC: 12,
            correctiveAction: "Moved stock",
          }),
        },
      );

      expect(response.status).toBe(200);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body.temperature).toEqual({
        recordedC: 12,
        minTempC: 0,
        maxTempC: 5,
        result: "out_of_range",
        correctiveAction: "Moved stock",
      });
      expect(body.recordedByUserId).toBe(org.admin.userId);

      const [detailRow] = await db
        .select()
        .from(taskRecordTemperatures)
        .where(eq(taskRecordTemperatures.taskRecordId, body.id));
      expect(detailRow?.recordedC).toBe("12.0");
    });

    it("reactivates a voided ordinary record and clears void attribution", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });
      await apiRequest(recordPath(org.locations.main.id, occurrenceId), {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify({ kind: "ordinary" }),
      });
      await apiRequest(recordPath(org.locations.main.id, occurrenceId), {
        method: "DELETE",
        actor: asEmployee(org),
      });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "PUT",
          actor: asEmployee(org),
          body: JSON.stringify({ kind: "ordinary" }),
        },
      );

      expect(response.status).toBe(200);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body.active).toBe(true);
      expect(body.voidedAt).toBeNull();
      expect(body.voidedByUserId).toBeNull();
    });

    it("reactivates a voided temperature record, restoring its detail", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });
      await apiRequest(recordPath(org.locations.main.id, occurrenceId), {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify({ kind: "temperature", recordedC: 3 }),
      });
      await apiRequest(recordPath(org.locations.main.id, occurrenceId), {
        method: "DELETE",
        actor: asEmployee(org),
      });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "PUT",
          actor: asEmployee(org),
          body: JSON.stringify({ kind: "temperature", recordedC: 2 }),
        },
      );

      expect(response.status).toBe(200);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body.active).toBe(true);
      expect(body.voidedAt).toBeNull();
      expect(body.temperature?.recordedC).toBe(2);
    });
  });

  describe("DELETE — soft void / Undo", () => {
    it("retains the row and temperature detail, setting void attribution", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });
      const created = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify({ kind: "temperature", recordedC: 3 }),
        },
      );
      const createdBody = taskRecordResponseSchema.parse(await created.json());

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        { method: "DELETE", actor: asAdmin(org) },
      );

      expect(response.status).toBe(200);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body.active).toBe(false);
      expect(body.voidedByUserId).toBe(org.admin.userId);
      expect(body.temperature).toEqual(createdBody.temperature);

      const [recordRow] = await db
        .select()
        .from(taskRecords)
        .where(eq(taskRecords.occurrenceId, occurrenceId));
      expect(recordRow).toBeDefined();
      const [detailRow] = await db
        .select()
        .from(taskRecordTemperatures)
        .where(eq(taskRecordTemperatures.taskRecordId, recordRow!.id));
      expect(detailRow).toBeDefined();
    });

    it("accepts no reason payload", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });
      await apiRequest(recordPath(org.locations.main.id, occurrenceId), {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify({ kind: "ordinary" }),
      });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        { method: "DELETE", actor: asEmployee(org) },
      );

      expect(response.status).toBe(200);
    });

    it("404s a repeated void of an already-voided record", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });
      await apiRequest(recordPath(org.locations.main.id, occurrenceId), {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify({ kind: "ordinary" }),
      });
      await apiRequest(recordPath(org.locations.main.id, occurrenceId), {
        method: "DELETE",
        actor: asEmployee(org),
      });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        { method: "DELETE", actor: asEmployee(org) },
      );

      expect(response.status).toBe(404);
    });

    it("404s void of an occurrence with no record", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        { method: "DELETE", actor: asEmployee(org) },
      );

      expect(response.status).toBe(404);
    });
  });

  describe("ownership boundary", () => {
    it("denies a forged occurrence/location mismatch within the same organization", async () => {
      const mainOccurrenceId = await insertOccurrence({
        type: "cleaning",
        locationId: org.locations.main.id,
      });

      const response = await apiRequest(
        recordPath(org.locations.annex.id, mainOccurrenceId),
        {
          method: "POST",
          actor: asAdmin(org),
          body: JSON.stringify({ kind: "ordinary" }),
        },
      );

      expect(response.status).toBe(404);
    });

    it("denies a cross-tenant occurrence id through the joined ownership chain", async () => {
      const world: TwoTenantWorld = await seedTwoTenants(db);
      const [alphaOccurrence] = await db
        .insert(taskOccurrences)
        .values({
          locationId: world.alpha.locations.main.id,
          taskTemplateId: world.alpha.templates.cleaning.id,
          occurrenceDate: zonedDateString(new Date(), world.alpha.timeZone),
          scheduledTime: "08:00",
          dueAt: new Date(),
          title: "Alpha occurrence",
          type: "cleaning",
        })
        .returning({ id: taskOccurrences.id });

      const response = await apiRequest(
        recordPath(world.beta.locations.main.id, alphaOccurrence!.id),
        {
          method: "POST",
          actor: asAdmin(world.beta),
          body: JSON.stringify({ kind: "ordinary" }),
        },
      );

      expect(response.status).toBe(404);
    });
  });
});
