import {
  API_ERROR_CODE,
  addCalendarDays,
  formResponseSchema,
  recordsListResponseSchema,
  taskRecordResponseSchema,
  todayResponseSchema,
  zonedDateString,
  zonedTimeString,
} from "@haccp/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  taskRecordReadings,
  taskRecords,
} from "../../src/core/db/schema/index.js";
import { PG_ERROR, postgresErrorCode } from "./harness/db.js";
import {
  CLEANING_FIELD_ID,
  FRIDGE_FIELD_ID,
  recordContextFor,
  seedOccurrence,
  seedOrganization,
  type SeededOrg,
} from "./harness/fixtures.js";
import { apiRequest, asAdmin, asEmployee } from "./harness/request.js";

describe("on-demand records", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "on-demand" });
  });

  /** An hour ago in the organisation's zone, so the entry is never in the future. */
  function anHourAgo(): { entryDate: string; entryTime: string } {
    const instant = new Date(Date.now() - 60 * 60_000);
    return {
      entryDate: zonedDateString(instant, org.timeZone),
      entryTime: zonedTimeString(instant, org.timeZone),
    };
  }

  function today(): string {
    return zonedDateString(new Date(), org.timeZone);
  }

  async function setOnDemand(
    formId: string,
    onDemand: boolean | undefined,
    owner: SeededOrg = org,
  ) {
    const current = formResponseSchema.parse(
      await (
        await apiRequest(`/forms/${formId}`, { actor: asAdmin(owner) })
      ).json(),
    );
    const response = await apiRequest(`/forms/${formId}`, {
      method: "PATCH",
      actor: asAdmin(owner),
      body: JSON.stringify({
        name: current.name,
        category: current.category,
        appliesTo: current.appliesTo,
        ...(onDemand === undefined ? {} : { onDemand }),
      }),
    });
    expect(response.status).toBe(200);
    return formResponseSchema.parse(await response.json());
  }

  function logEntry(
    formId: string,
    body: Record<string, unknown> = {},
    options: { locationId?: string; actor?: ReturnType<typeof asAdmin> } = {},
  ) {
    const locationId = options.locationId ?? org.locations.main.id;
    return apiRequest(`/locations/${locationId}/today/forms/${formId}/records`, {
      method: "POST",
      actor: options.actor ?? asEmployee(org),
      body: JSON.stringify({
        formVersionId: org.forms.fridgeCheck.versionId,
        targetId: org.targets.fridge.id,
        values: { [FRIDGE_FIELD_ID]: 2 },
        ...anHourAgo(),
        ...body,
      }),
    });
  }

  async function getToday() {
    const response = await apiRequest(
      `/locations/${org.locations.main.id}/today?date=${today()}`,
      { actor: asEmployee(org) },
    );
    expect(response.status).toBe(200);
    return todayResponseSchema.parse(await response.json());
  }

  async function getRecords(query: Record<string, string> = {}) {
    const params = new URLSearchParams({
      dateFrom: addCalendarDays(today(), -2),
      dateTo: today(),
      ...query,
    });
    const response = await apiRequest(
      `/locations/${org.locations.main.id}/records?${params.toString()}`,
      { actor: asAdmin(org) },
    );
    expect(response.status).toBe(200);
    return recordsListResponseSchema.parse(await response.json());
  }

  describe("the form setting", () => {
    it("is off for a new form and can be turned on and off", async () => {
      expect(
        (await setOnDemand(org.forms.fridgeCheck.id, undefined)).onDemand,
      ).toBe(false);
      expect((await setOnDemand(org.forms.fridgeCheck.id, true)).onDemand).toBe(
        true,
      );
      // An update that leaves it out keeps it.
      expect(
        (await setOnDemand(org.forms.fridgeCheck.id, undefined)).onDemand,
      ).toBe(true);
      expect(
        (await setOnDemand(org.forms.fridgeCheck.id, false)).onDemand,
      ).toBe(false);
    });
  });

  describe("Today", () => {
    it("offers only flagged forms, with their own limits, and the location's items", async () => {
      await setOnDemand(org.forms.fridgeCheck.id, true);

      const body = await getToday();

      expect(body.onDemand.forms).toEqual([
        {
          formId: org.forms.fridgeCheck.id,
          name: expect.any(String),
          formVersionId: org.forms.fridgeCheck.versionId,
          appliesTo: "per_item",
          resolvedLimits: { [FRIDGE_FIELD_ID]: { min: 0, max: 5 } },
        },
      ]);
      expect(body.onDemand.items).toEqual([
        { targetId: org.targets.fridge.id, targetName: org.targets.fridge.name },
      ]);
      expect(body.formVersions[org.forms.fridgeCheck.versionId]).toBeDefined();
    });

    it("drops an archived form", async () => {
      await setOnDemand(org.forms.cleaning.id, true);
      // Archiving refuses a form a task still uses, so retire the seeded one first.
      await apiRequest(
        `/locations/${org.locations.main.id}/task-templates/${org.templates.cleaning.id}`,
        { method: "DELETE", actor: asAdmin(org) },
      );
      const archived = await apiRequest(`/forms/${org.forms.cleaning.id}`, {
        method: "DELETE",
        actor: asAdmin(org),
      });
      expect(archived.status).toBe(204);

      expect((await getToday()).onDemand.forms).toEqual([]);
    });
  });

  describe("logging an entry", () => {
    it("stores a record with no task or occurrence, judged by the form's limits", async () => {
      await setOnDemand(org.forms.fridgeCheck.id, true);
      const entry = anHourAgo();

      const refused = await logEntry(org.forms.fridgeCheck.id, {
        values: { [FRIDGE_FIELD_ID]: 6 },
      });
      expect(refused.status).toBe(400);

      const response = await logEntry(org.forms.fridgeCheck.id, {
        values: { [FRIDGE_FIELD_ID]: 6 },
        correctiveAction: "Moved to the walk-in",
        ...entry,
      });

      expect(response.status).toBe(201);
      const record = taskRecordResponseSchema.parse(await response.json());
      expect(record).toMatchObject({
        kind: "on_demand",
        occurrenceId: null,
        taskTemplateId: null,
        formVersionId: org.forms.fridgeCheck.versionId,
        result: "fail",
        ...entry,
      });

      const [row] = await db
        .select()
        .from(taskRecords)
        .where(eq(taskRecords.id, record.id));
      expect(row).toMatchObject({
        targetId: org.targets.fridge.id,
        targetName: org.targets.fridge.name,
        resolvedLimits: { [FRIDGE_FIELD_ID]: { min: 0, max: 5 } },
      });

      const readings = await db
        .select()
        .from(taskRecordReadings)
        .where(eq(taskRecordReadings.taskRecordId, record.id));
      expect(readings).toMatchObject([
        { targetId: org.targets.fridge.id, value: "6.0000", fails: true },
      ]);

      expect((await getToday()).onDemand.entries).toMatchObject([
        {
          kind: "on_demand",
          recordId: record.id,
          occurrenceId: null,
          templateId: null,
          targetName: org.targets.fridge.name,
          scheduledTime: entry.entryTime,
          result: "fail",
        },
      ]);
    });

    it("logs a whole-location form without an item, and refuses one with an item", async () => {
      await setOnDemand(org.forms.cleaning.id, true);
      const body = {
        formVersionId: org.forms.cleaning.versionId,
        values: { [CLEANING_FIELD_ID]: true },
      };

      const withoutItem = await logEntry(org.forms.cleaning.id, {
        ...body,
        targetId: null,
      });
      const withItem = await logEntry(org.forms.cleaning.id, body);

      expect(withoutItem.status).toBe(201);
      expect(withItem.status).toBe(400);
    });

    it("refuses an entry filled against an older form version", async () => {
      await setOnDemand(org.forms.fridgeCheck.id, true);

      const response = await logEntry(org.forms.fridgeCheck.id, {
        formVersionId: org.forms.cleaning.versionId,
      });

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({
        error: API_ERROR_CODE.FORM_VERSION_CHANGED,
      });
    });

    it("refuses an entry in the future", async () => {
      await setOnDemand(org.forms.fridgeCheck.id, true);
      const later = new Date(Date.now() + 60 * 60_000);

      const response = await logEntry(org.forms.fridgeCheck.id, {
        entryDate: zonedDateString(later, org.timeZone),
        entryTime: zonedTimeString(later, org.timeZone),
      });

      expect(response.status).toBe(400);
    });

    it("404s a form that is not logged when needed, or another organisation's", async () => {
      const other = await seedOrganization(db, { slug: "on-demand-other" });
      await setOnDemand(other.forms.fridgeCheck.id, true, other);

      const notFlagged = await logEntry(org.forms.fridgeCheck.id);
      const foreign = await logEntry(other.forms.fridgeCheck.id, {
        formVersionId: other.forms.fridgeCheck.versionId,
      });

      expect(notFlagged.status).toBe(404);
      expect(foreign.status).toBe(404);
    });

    it("404s a missing item or one at another location", async () => {
      await setOnDemand(org.forms.fridgeCheck.id, true);

      // An admin may reach the annex, so this proves the item's location is checked.
      const elsewhere = await logEntry(
        org.forms.fridgeCheck.id,
        {},
        { locationId: org.locations.annex.id, actor: asAdmin(org) },
      );
      const noItem = await logEntry(org.forms.fridgeCheck.id, {
        targetId: null,
      });

      expect(elsewhere.status).toBe(404);
      expect(noItem.status).toBe(404);
    });
  });

  describe("editing and undoing an entry", () => {
    it("edits the answers, then undoes the entry", async () => {
      await setOnDemand(org.forms.fridgeCheck.id, true);
      const created = taskRecordResponseSchema.parse(
        await (await logEntry(org.forms.fridgeCheck.id)).json(),
      );
      const path = `/locations/${org.locations.main.id}/today/records/${created.id}`;

      const edited = await apiRequest(path, {
        method: "PUT",
        actor: asEmployee(org),
        body: JSON.stringify({ values: { [FRIDGE_FIELD_ID]: 1 } }),
      });
      expect(edited.status).toBe(200);
      expect(taskRecordResponseSchema.parse(await edited.json())).toMatchObject({
        entryDate: created.entryDate,
        entryTime: created.entryTime,
        values: { [FRIDGE_FIELD_ID]: { value: 1 } },
      });

      const undone = await apiRequest(path, {
        method: "DELETE",
        actor: asEmployee(org),
      });
      expect(undone.status).toBe(200);
      expect((await getToday()).onDemand.entries).toEqual([]);

      const records = await getRecords({ state: "voided" });
      expect(records.items.map((item) => item.id)).toEqual([created.id]);
    });
  });

  describe("Records", () => {
    it("lists on-demand entries in time order with scheduled checks", async () => {
      await setOnDemand(org.forms.fridgeCheck.id, true);
      const yesterday = addCalendarDays(today(), -1);
      const missedId = await seedOccurrence(db, org, {
        type: "cleaning",
        occurrenceDate: yesterday,
        scheduledTime: "09:00",
      });
      const entry = taskRecordResponseSchema.parse(
        await (
          await logEntry(org.forms.fridgeCheck.id, {
            entryDate: yesterday,
            entryTime: "08:30",
          })
        ).json(),
      );

      const page = await getRecords();
      const ids = page.items.map((item) => item.id);
      expect(ids.indexOf(entry.id)).toBeLessThan(ids.indexOf(missedId));
      expect(page.total).toBe(page.items.length);

      expect(page.items.find((item) => item.id === entry.id)).toMatchObject({
        kind: "on_demand",
        occurrenceId: null,
        taskTemplateId: null,
        availableAt: null,
        dueAt: null,
        entryDate: yesterday,
        entryTime: "08:30",
        displayState: "submitted",
        timing: "no_deadline",
      });
    });

    it("keeps on-demand entries out of the missed and open filters", async () => {
      await setOnDemand(org.forms.fridgeCheck.id, true);
      await logEntry(org.forms.fridgeCheck.id);

      const missedOrOpen = await getRecords({ state: "missed,open" });
      const submitted = await getRecords({ state: "submitted" });

      expect(
        missedOrOpen.items.some((item) => item.kind === "on_demand"),
      ).toBe(false);
      expect(submitted.items.map((item) => item.kind)).toContain("on_demand");
      expect(submitted.total).toBe(submitted.items.length);
    });
  });

  describe("database", () => {
    it("refuses a record that has an occurrence but no task", async () => {
      const occurrenceId = await seedOccurrence(db, org, {
        type: "cleaning",
        occurrenceDate: today(),
      });

      let code: string | null = null;
      try {
        await db.insert(taskRecords).values({
          ...(await recordContextFor(db, occurrenceId)),
          taskTemplateId: null,
          values: {},
          result: "not_evaluated",
          createdByUserId: org.admin.userId,
          recordedAt: new Date(),
          recordedByUserId: org.admin.userId,
        });
      } catch (error) {
        code = postgresErrorCode(error);
      }

      expect(code).toBe(PG_ERROR.CHECK_VIOLATION);
    });
  });
});
