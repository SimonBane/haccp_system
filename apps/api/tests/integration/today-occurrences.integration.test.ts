import { getWeekdayFromDate, todayResponseSchema, zonedDateString } from "@haccp/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/core/db/client.js";
import { taskOccurrences, taskTemplates } from "../../src/core/db/schema/index.js";
import { seedOrganization, type SeededOrg } from "./harness/fixtures.js";
import { apiRequest, asAdmin, asEmployee } from "./harness/request.js";

/**
 * HACCP-15: Today's GET reads task_occurrences + the current task_record only —
 * never task_templates/equipment — and never materializes work as a side effect.
 */
describe("Today occurrences (GET)", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "today-occurrences" });
  });

  function today(): string {
    return zonedDateString(new Date(), org.timeZone);
  }

  async function insertOccurrence(overrides: {
    type: "temperature" | "cleaning";
    locationId?: string;
    scheduledTime?: string;
    occurrenceDate?: string;
    dueAt?: Date;
    title?: string;
    equipmentName?: string | null;
    minTempC?: string | null;
    maxTempC?: string | null;
  }): Promise<string> {
    const locationId = overrides.locationId ?? org.locations.main.id;
    const taskTemplateId =
      overrides.type === "temperature"
        ? org.templates.temperature.id
        : org.templates.cleaning.id;
    const occurrenceDate = overrides.occurrenceDate ?? today();
    const scheduledTime = overrides.scheduledTime ?? "08:00";

    const [row] = await db
      .insert(taskOccurrences)
      .values({
        locationId,
        taskTemplateId,
        occurrenceDate,
        scheduledTime,
        dueAt: overrides.dueAt ?? new Date(`${occurrenceDate}T${scheduledTime}:00Z`),
        title: overrides.title ?? "Test occurrence",
        type: overrides.type,
        equipmentId: overrides.type === "temperature" ? org.equipment.fridge.id : null,
        equipmentName:
          overrides.type === "temperature"
            ? (overrides.equipmentName ?? "Fridge 1")
            : null,
        minTempC:
          overrides.type === "temperature" ? (overrides.minTempC ?? "0.0") : null,
        maxTempC:
          overrides.type === "temperature" ? (overrides.maxTempC ?? "5.0") : null,
      })
      .returning({ id: taskOccurrences.id });

    return row!.id;
  }

  function recordPath(locationId: string, occurrenceId: string): string {
    return `/locations/${locationId}/today/occurrences/${occurrenceId}/record`;
  }

  function todayGet(locationId: string, date: string) {
    return apiRequest(`/locations/${locationId}/today?date=${date}`, {
      actor: asEmployee(org),
    });
  }

  it("maps none/active/voided occurrences and scopes strictly by location", async () => {
    const noneId = await insertOccurrence({ type: "cleaning", scheduledTime: "07:00" });
    const activeId = await insertOccurrence({ type: "cleaning", scheduledTime: "08:00" });
    const voidedId = await insertOccurrence({ type: "cleaning", scheduledTime: "09:00" });

    // The FK ties an occurrence's (templateId, locationId) to a real template row there.
    const [annexTemplate] = await db
      .insert(taskTemplates)
      .values({
        locationId: org.locations.annex.id,
        title: "Annex cleaning",
        type: "cleaning",
        weekdays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        scheduledTimes: ["10:00"],
      })
      .returning({ id: taskTemplates.id });
    await db.insert(taskOccurrences).values({
      locationId: org.locations.annex.id,
      taskTemplateId: annexTemplate!.id,
      occurrenceDate: today(),
      scheduledTime: "10:00",
      dueAt: new Date(`${today()}T10:00:00Z`),
      title: "Annex occurrence",
      type: "cleaning",
    });

    const activeCreate = await apiRequest(recordPath(org.locations.main.id, activeId), {
      method: "POST",
      actor: asEmployee(org),
      body: JSON.stringify({ kind: "ordinary" }),
    });
    expect(activeCreate.status).toBe(201);

    const voidedCreate = await apiRequest(recordPath(org.locations.main.id, voidedId), {
      method: "POST",
      actor: asEmployee(org),
      body: JSON.stringify({ kind: "ordinary" }),
    });
    expect(voidedCreate.status).toBe(201);
    const voidedUndo = await apiRequest(recordPath(org.locations.main.id, voidedId), {
      method: "DELETE",
      actor: asEmployee(org),
    });
    expect(voidedUndo.status).toBe(200);

    const response = await todayGet(org.locations.main.id, today());
    expect(response.status).toBe(200);
    const body = todayResponseSchema.parse(await response.json());
    const items = [...body.sections.morning, ...body.sections.afternoon, ...body.sections.evening];

    expect(items.map((item) => item.occurrenceId).sort()).toEqual(
      [noneId, activeId, voidedId].sort(),
    );

    const noneItem = items.find((item) => item.occurrenceId === noneId)!;
    expect(noneItem.recordState).toBe("none");
    expect(noneItem.completedAt).toBeNull();

    const activeItem = items.find((item) => item.occurrenceId === activeId)!;
    expect(activeItem.recordState).toBe("active");
    expect(activeItem.status).toBe("completed");
    expect(activeItem.completedAt).not.toBeNull();

    const voidedItem = items.find((item) => item.occurrenceId === voidedId)!;
    expect(voidedItem.recordState).toBe("voided");
    expect(voidedItem.completedAt).toBeNull();
    expect(voidedItem.completedBy).toBeNull();
  });

  it("reports the occurrence's own stored title/equipment/range, not the live template/equipment", async () => {
    // Deliberately stale relative to the seeded template/equipment — proves GET never joins them.
    const occurrenceId = await insertOccurrence({
      type: "temperature",
      title: "Historical fridge check (old wording)",
      equipmentName: "Old fridge label",
      minTempC: "-2.0",
      maxTempC: "3.0",
    });

    const response = await todayGet(org.locations.main.id, today());
    const body = todayResponseSchema.parse(await response.json());
    const items = [...body.sections.morning, ...body.sections.afternoon, ...body.sections.evening];
    const item = items.find((entry) => entry.occurrenceId === occurrenceId)!;

    expect(item.title).toBe("Historical fridge check (old wording)");
    expect(item.equipmentName).toBe("Old fridge label");
    expect(item.minTempC).toBe(-2);
    expect(item.maxTempC).toBe(3);
  });

  it("shows a template creation's reconciled occurrence on an immediate refetch", async () => {
    const weekday = getWeekdayFromDate(today());

    const response = await apiRequest(`/locations/${org.locations.main.id}/task-templates`, {
      method: "POST",
      actor: asAdmin(org),
      body: JSON.stringify({
        title: "Evening close-down",
        type: "cleaning",
        weekdays: [weekday],
        scheduledTimes: ["23:59"],
      }),
    });
    expect(response.status).toBe(201);
    const created = (await response.json()) as { id: string };

    const getResponse = await todayGet(org.locations.main.id, today());
    const body = todayResponseSchema.parse(await getResponse.json());
    const evening = body.sections.evening;

    expect(evening.some((item) => item.templateId === created.id)).toBe(true);
  });

  it("never materializes work as a side effect of a read", async () => {
    const before = await db.select().from(taskOccurrences);

    const response = await todayGet(org.locations.main.id, today());
    expect(response.status).toBe(200);

    const after = await db.select().from(taskOccurrences);
    expect(after.length).toBe(before.length);
  });
});
