import {
  addCalendarDays,
  taskRecordResponseSchema,
  zonedDateString,
} from "@haccp/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  formVersions,
  taskOccurrences,
  taskRecordReadings,
  taskRecords,
} from "../../src/core/db/schema/index.js";
import {
  CLEANING_FIELD_ID,
  FRIDGE_CHECK_DEFINITION,
  FRIDGE_FIELD_ID,
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
const CLEANED = { values: { [CLEANING_FIELD_ID]: true } };

function reading(value: number, correctiveAction?: string) {
  return {
    values: { [FRIDGE_FIELD_ID]: value },
    ...(correctiveAction === undefined ? {} : { correctiveAction }),
  };
}

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
    formVersionId?: string;
    maxTempC?: number;
    availableAt?: Date;
    dueAt?: Date | null;
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
        // Default: available from the start of the occurrence's calendar day, matching
        // the default 1440-minute completion window — a future-dated default occurrence
        // stays closed, a past-dated one is already open.
        availableAt:
          overrides.availableAt ?? new Date(`${occurrenceDate}T00:00:00Z`),
        dueAt:
          overrides.dueAt === undefined
            ? new Date(`${occurrenceDate}T08:00:00Z`)
            : overrides.dueAt,
        title: "Test occurrence",
        formVersionId:
          overrides.formVersionId ??
          (overrides.type === "temperature"
            ? org.forms.fridgeCheck.versionId
            : org.forms.cleaning.versionId),
        targetId:
          overrides.type === "temperature" ? org.targets.fridge.id : null,
        targetName: overrides.type === "temperature" ? "Fridge 1" : null,
        resolvedLimits:
          overrides.type === "temperature"
            ? { [FRIDGE_FIELD_ID]: { min: 0, max: overrides.maxTempC ?? 5 } }
            : {},
      })
      .returning({ id: taskOccurrences.id });

    return row!.id;
  }

  function recordPath(locationId: string, occurrenceId: string): string {
    return `/locations/${locationId}/today/occurrences/${occurrenceId}/record`;
  }

  describe("POST — first submission", () => {
    it("submits a record for a form that cannot fail as not evaluated", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(CLEANED),
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
        formVersionId: org.forms.cleaning.versionId,
        result: "not_evaluated",
        values: { [CLEANING_FIELD_ID]: { type: "checkbox", value: true } },
        correctiveAction: null,
      });
    });

    it("submits a passing reading and stores it as a typed reading", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(reading(3)),
        },
      );

      expect(response.status).toBe(201);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body.result).toBe("pass");
      expect(body.values[FRIDGE_FIELD_ID]).toEqual({
        type: "measurement",
        value: 3,
        unit: "celsius",
        min: 0,
        max: 5,
        fails: false,
      });

      const readings = await db
        .select()
        .from(taskRecordReadings)
        .where(eq(taskRecordReadings.taskRecordId, body.id));
      expect(readings).toHaveLength(1);
      expect(readings[0]).toMatchObject({
        fieldId: FRIDGE_FIELD_ID,
        targetId: org.targets.fridge.id,
        locationId: org.locations.main.id,
        unit: "celsius",
        value: "3.0000",
        minValue: "0.0000",
        maxValue: "5.0000",
        fails: false,
      });
    });

    it("rejects a failing reading with no corrective action", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(reading(12)),
        },
      );

      expect(response.status).toBe(400);

      const rows = await db
        .select()
        .from(taskRecords)
        .where(eq(taskRecords.occurrenceId, occurrenceId));
      expect(rows).toHaveLength(0);
    });

    it("accepts a failing reading with a corrective action", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(reading(12, "Moved stock to backup fridge")),
        },
      );

      expect(response.status).toBe(201);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body.result).toBe("fail");
      expect(body.values[FRIDGE_FIELD_ID]).toMatchObject({
        value: 12,
        fails: true,
      });
      expect(body.correctiveAction).toBe("Moved stock to backup fridge");
    });

    it("judges a reading against the occurrence's resolved limits, not the form's default", async () => {
      const occurrenceId = await insertOccurrence({
        type: "temperature",
        maxTempC: 2,
      });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(reading(3)),
        },
      );

      // 3 °C is inside the form's 0–5 default but outside this target's 0–2 override.
      expect(response.status).toBe(400);
    });

    it("validates against the occurrence's own form version after a newer one exists", async () => {
      const [newer] = await db
        .insert(formVersions)
        .values({
          formId: org.forms.fridgeCheck.id,
          version: 2,
          definition: {
            ...FRIDGE_CHECK_DEFINITION,
            fields: [
              ...FRIDGE_CHECK_DEFINITION.fields,
              {
                id: "door_closed",
                type: "checkbox",
                label: "Door closed",
                required: true,
              },
            ],
          },
        })
        .returning();
      expect(newer).toBeDefined();
      const occurrenceId = await insertOccurrence({ type: "temperature" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(reading(3)),
        },
      );

      expect(response.status).toBe(201);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body.formVersionId).toBe(org.forms.fridgeCheck.versionId);
    });

    it("rejects a reading outside the unit's range", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(reading(150)),
        },
      );

      expect(response.status).toBe(400);
    });

    it("rejects an answer for a field the occurrence's form does not have", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(reading(3)),
        },
      );

      expect(response.status).toBe(400);
    });

    it("rejects a missing required answer", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify({ values: {} }),
        },
      );

      expect(response.status).toBe(400);
    });

    it("rejects an unticked required checkbox", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify({ values: { [CLEANING_FIELD_ID]: false } }),
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
          body: JSON.stringify(CLEANED),
        },
      );
      expect(first.status).toBe(201);
      const firstBody = taskRecordResponseSchema.parse(await first.json());

      const second = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asAdmin(org),
          body: JSON.stringify(CLEANED),
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
          body: JSON.stringify(CLEANED),
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
          body: JSON.stringify(CLEANED),
        },
      );

      expect(response.status).toBe(201);
    });

    it("rejects a write before availableAt", async () => {
      const occurrenceId = await insertOccurrence({
        type: "cleaning",
        // Far enough ahead that the DB round-trip itself can't close the gap.
        availableAt: new Date(Date.now() + 60_000),
      });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(CLEANED),
        },
      );

      expect(response.status).toBe(400);
    });

    it("accepts a write at exactly availableAt", async () => {
      const occurrenceId = await insertOccurrence({
        type: "cleaning",
        availableAt: new Date(),
      });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(CLEANED),
        },
      );

      expect(response.status).toBe(201);
    });

    it("accepts a late submission past a finite deadline — the deadline never disables completion", async () => {
      const occurrenceId = await insertOccurrence({
        type: "cleaning",
        dueAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(CLEANED),
        },
      );

      expect(response.status).toBe(201);
    });

    it("accepts a no-deadline submission long after it opened", async () => {
      const occurrenceId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: addCalendarDays(today(), -30),
        availableAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        dueAt: null,
      });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(CLEANED),
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
          body: JSON.stringify(CLEANED),
        },
      );

      expect(response.status).toBe(404);
    });

    it("replaces the answers, readings and attribution on an active record", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });
      await apiRequest(recordPath(org.locations.main.id, occurrenceId), {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify(reading(3)),
      });

      const response = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "PUT",
          actor: asAdmin(org),
          body: JSON.stringify(reading(12, "Moved stock")),
        },
      );

      expect(response.status).toBe(200);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body.result).toBe("fail");
      expect(body.correctiveAction).toBe("Moved stock");
      expect(body.recordedByUserId).toBe(org.admin.userId);

      const readings = await db
        .select()
        .from(taskRecordReadings)
        .where(eq(taskRecordReadings.taskRecordId, body.id));
      expect(readings.map((row) => [row.value, row.fails])).toEqual([
        ["12.0000", true],
      ]);
    });

    it("reactivates a voided record and clears void attribution", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });
      await apiRequest(recordPath(org.locations.main.id, occurrenceId), {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify(CLEANED),
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
          body: JSON.stringify(CLEANED),
        },
      );

      expect(response.status).toBe(200);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body.active).toBe(true);
      expect(body.voidedAt).toBeNull();
      expect(body.voidedByUserId).toBeNull();
    });

    it("reactivates a voided reading with new answers", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });
      await apiRequest(recordPath(org.locations.main.id, occurrenceId), {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify(reading(3)),
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
          body: JSON.stringify(reading(2)),
        },
      );

      expect(response.status).toBe(200);
      const body = taskRecordResponseSchema.parse(await response.json());
      expect(body.active).toBe(true);
      expect(body.voidedAt).toBeNull();
      expect(body.values[FRIDGE_FIELD_ID]).toMatchObject({ value: 2 });
    });
  });

  describe("DELETE — soft void / Undo", () => {
    it("retains the row, answers and readings, setting void attribution", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });
      const created = await apiRequest(
        recordPath(org.locations.main.id, occurrenceId),
        {
          method: "POST",
          actor: asEmployee(org),
          body: JSON.stringify(reading(3)),
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
      expect(body.values).toEqual(createdBody.values);
      expect(body.result).toBe(createdBody.result);

      const [recordRow] = await db
        .select()
        .from(taskRecords)
        .where(eq(taskRecords.occurrenceId, occurrenceId));
      expect(recordRow).toBeDefined();
      const readings = await db
        .select()
        .from(taskRecordReadings)
        .where(eq(taskRecordReadings.taskRecordId, recordRow!.id));
      expect(readings).toHaveLength(1);
    });

    it("accepts no reason payload", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });
      await apiRequest(recordPath(org.locations.main.id, occurrenceId), {
        method: "POST",
        actor: asEmployee(org),
        body: JSON.stringify(CLEANED),
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
        body: JSON.stringify(CLEANED),
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
          body: JSON.stringify(CLEANED),
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
          availableAt: new Date(Date.now() - 60_000),
          dueAt: new Date(),
          title: "Alpha occurrence",
          formVersionId: world.alpha.forms.cleaning.versionId,
        })
        .returning({ id: taskOccurrences.id });

      const response = await apiRequest(
        recordPath(world.beta.locations.main.id, alphaOccurrence!.id),
        {
          method: "POST",
          actor: asAdmin(world.beta),
          body: JSON.stringify(CLEANED),
        },
      );

      expect(response.status).toBe(404);
    });
  });
});
