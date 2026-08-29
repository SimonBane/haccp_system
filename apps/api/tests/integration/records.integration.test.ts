import {
  addCalendarDays,
  compareCalendarDates,
  endOfCalendarMonth,
  getWeekdayFromDate,
  recordsListResponseSchema,
  wallClockToInstant,
  zonedDateString,
  type RecordItem,
  type RecordsListResponse,
} from "@haccp/shared";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  equipment,
  taskOccurrences,
  taskRecords,
  taskRecordTemperatures,
  taskTemplates,
} from "../../src/core/db/schema/index.js";
import {
  seedOrganization,
  seedTwoTenants,
  type SeededOrg,
  type TwoTenantWorld,
} from "./harness/fixtures.js";
import { apiRequest, asAdmin, asEmployee } from "./harness/request.js";

/**
 * HACCP-6: the admin-only historical Records endpoint — eligibility, organization-local
 * date scope, SQL paging/sorting/filtering and both totals.
 */
describe("Records list (GET)", () => {
  let org: SeededOrg;

  beforeEach(async () => {
    org = await seedOrganization(db, { slug: "records" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function today(): string {
    return zonedDateString(new Date(), org.timeZone);
  }

  function daysAgo(days: number): string {
    return addCalendarDays(today(), -days);
  }

  /** The same month-day in the most recent year where it is already in the past. */
  function lastPast(monthDay: string): string {
    const current = today();
    const year = Number(current.slice(0, 4));
    const candidate = `${year}-${monthDay}`;

    return compareCalendarDates(candidate, current) <= 0
      ? candidate
      : `${year - 1}-${monthDay}`;
  }

  /** Sofia switches on the last Sunday of March and of October. */
  function lastSundayOfMonth(reference: string): string {
    let date = endOfCalendarMonth(reference);
    while (getWeekdayFromDate(date) !== "sunday") {
      date = addCalendarDays(date, -1);
    }
    return date;
  }

  async function insertOccurrence(overrides: {
    type: "temperature" | "cleaning";
    occurrenceDate?: string;
    scheduledTime?: string;
    availableAt?: Date;
    dueAt?: Date | null;
    title?: string;
    locationId?: string;
    templateId?: string;
  }): Promise<string> {
    const locationId = overrides.locationId ?? org.locations.main.id;
    const occurrenceDate = overrides.occurrenceDate ?? daysAgo(1);
    const scheduledTime = overrides.scheduledTime ?? "08:00";
    const isTemperature = overrides.type === "temperature";

    const [row] = await db
      .insert(taskOccurrences)
      .values({
        locationId,
        taskTemplateId:
          overrides.templateId ??
          (isTemperature
            ? org.templates.temperature.id
            : org.templates.cleaning.id),
        occurrenceDate,
        scheduledTime,
        availableAt:
          overrides.availableAt ??
          wallClockToInstant(occurrenceDate, "00:00", org.timeZone),
        dueAt:
          overrides.dueAt === undefined
            ? wallClockToInstant(occurrenceDate, scheduledTime, org.timeZone)
            : overrides.dueAt,
        title:
          overrides.title ??
          (isTemperature
            ? org.templates.temperature.title
            : org.templates.cleaning.title),
        type: overrides.type,
        equipmentId: isTemperature ? org.equipment.fridge.id : null,
        equipmentName: isTemperature ? org.equipment.fridge.name : null,
        minTempC: isTemperature ? "0.0" : null,
        maxTempC: isTemperature ? "5.0" : null,
      })
      .returning({ id: taskOccurrences.id });

    return row!.id;
  }

  async function insertRecord(
    occurrenceId: string,
    overrides: {
      recordedAt: Date;
      createdAt?: Date;
      createdByUserId?: string;
      recordedByUserId?: string;
      voidedAt?: Date | null;
      voidedByUserId?: string | null;
      temperature?: {
        recordedC: string;
        result: "ok" | "out_of_range";
        correctiveAction?: string | null;
      };
    },
  ): Promise<string> {
    const [record] = await db
      .insert(taskRecords)
      .values({
        occurrenceId,
        createdAt: overrides.createdAt ?? overrides.recordedAt,
        createdByUserId: overrides.createdByUserId ?? org.admin.userId,
        recordedAt: overrides.recordedAt,
        recordedByUserId: overrides.recordedByUserId ?? org.employee.userId,
        voidedAt: overrides.voidedAt ?? null,
        voidedByUserId: overrides.voidedByUserId ?? null,
      })
      .returning({ id: taskRecords.id });

    if (overrides.temperature) {
      await db.insert(taskRecordTemperatures).values({
        taskRecordId: record!.id,
        recordedC: overrides.temperature.recordedC,
        minTempC: "0.0",
        maxTempC: "5.0",
        result: overrides.temperature.result,
        correctiveAction: overrides.temperature.correctiveAction ?? null,
      });
    }

    return record!.id;
  }

  function recordsPath(
    query: Record<string, string>,
    locationId = org.locations.main.id,
  ): string {
    const params = new URLSearchParams({
      dateFrom: daysAgo(6),
      dateTo: today(),
      ...query,
    });

    return `/locations/${locationId}/records?${params.toString()}`;
  }

  async function listRecords(
    query: Record<string, string> = {},
    options: {
      locationId?: string;
      actor?: Parameters<typeof apiRequest>[1];
    } = {},
  ): Promise<RecordsListResponse> {
    const response = await apiRequest(
      recordsPath(query, options.locationId ?? org.locations.main.id),
      { actor: asAdmin(org), ...(options.actor ?? {}) },
    );

    expect(response.status).toBe(200);
    return recordsListResponseSchema.parse(await response.json());
  }

  function titles(page: RecordsListResponse): string[] {
    return page.items.map((item) => item.title);
  }

  function find(page: RecordsListResponse, occurrenceId: string): RecordItem {
    const item = page.items.find((row) => row.occurrenceId === occurrenceId);
    expect(item, `occurrence ${occurrenceId} missing from page`).toBeDefined();
    return item!;
  }

  describe("eligibility", () => {
    it("includes submitted, missed and voided rows, and never a future occurrence", async () => {
      const submittedId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "07:00",
      });
      await insertRecord(submittedId, {
        recordedAt: wallClockToInstant(daysAgo(1), "06:50", org.timeZone),
      });

      const missedId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "08:00",
      });

      const voidedId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "09:00",
      });
      await insertRecord(voidedId, {
        recordedAt: wallClockToInstant(daysAgo(1), "08:55", org.timeZone),
        voidedAt: new Date(),
        voidedByUserId: org.admin.userId,
      });

      // Due later today: operational work, not audit evidence.
      const futureId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: today(),
        scheduledTime: "23:59",
        dueAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const page = await listRecords();
      const ids = page.items.map((item) => item.occurrenceId);

      expect(ids).toContain(submittedId);
      expect(ids).toContain(missedId);
      expect(ids).toContain(voidedId);
      expect(ids).not.toContain(futureId);

      expect(find(page, submittedId).displayState).toBe("submitted");
      expect(find(page, missedId).displayState).toBe("missed");
      expect(find(page, voidedId).displayState).toBe("voided");
      expect(find(page, missedId).recordState).toBe("none");
      expect(find(page, voidedId).recordState).toBe("voided");
    });

    it("includes an early submission and an early void before the due time", async () => {
      const dueAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

      const earlyId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: today(),
        scheduledTime: "23:00",
        dueAt,
      });
      await insertRecord(earlyId, { recordedAt: new Date() });

      const earlyVoidId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: today(),
        scheduledTime: "23:30",
        dueAt,
      });
      await insertRecord(earlyVoidId, {
        recordedAt: new Date(),
        voidedAt: new Date(),
        voidedByUserId: org.admin.userId,
      });

      const page = await listRecords();

      expect(find(page, earlyId).displayState).toBe("submitted");
      expect(find(page, earlyId).timing).toBe("on_time");
      expect(find(page, earlyVoidId).displayState).toBe("voided");
    });

    it("derives on_time and late from the stored due instant", async () => {
      const onTimeId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "07:00",
      });
      await insertRecord(onTimeId, {
        recordedAt: wallClockToInstant(daysAgo(1), "06:00", org.timeZone),
      });

      const lateId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "08:00",
      });
      await insertRecord(lateId, {
        recordedAt: wallClockToInstant(daysAgo(1), "10:00", org.timeZone),
      });

      const page = await listRecords();

      expect(find(page, onTimeId).timing).toBe("on_time");
      expect(find(page, lateId).timing).toBe("late");
      expect(find(page, lateId).displayState).toBe("submitted");
    });

    it("excludes a finite, unrecorded occurrence before its deadline even once it has opened", async () => {
      const pendingId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: today(),
        scheduledTime: "23:59",
        availableAt: new Date(Date.now() - 60 * 60 * 1000),
        dueAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const page = await listRecords();

      expect(page.items.map((item) => item.occurrenceId)).not.toContain(
        pendingId,
      );
    });

    it("includes an opened, unrecorded no-deadline occurrence as Open, not Missed", async () => {
      const openId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "07:00",
        dueAt: null,
      });

      const page = await listRecords();

      expect(find(page, openId).displayState).toBe("open");
      expect(find(page, openId).recordState).toBe("none");
      expect(find(page, openId).timing).toBe("not_submitted");
      expect(find(page, openId).dueAt).toBeNull();
    });

    it("excludes an unopened no-deadline occurrence — it has not become outstanding yet", async () => {
      const unopenedId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: today(),
        scheduledTime: "23:59",
        availableAt: new Date(Date.now() + 60 * 60 * 1000),
        dueAt: null,
      });

      const page = await listRecords();

      expect(page.items.map((item) => item.occurrenceId)).not.toContain(
        unopenedId,
      );
    });

    it("maps a submitted no-deadline record to No deadline timing, not Late", async () => {
      const submittedOpenId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "07:00",
        dueAt: null,
      });
      await insertRecord(submittedOpenId, {
        recordedAt: wallClockToInstant(daysAgo(1), "20:00", org.timeZone),
      });

      const page = await listRecords();

      expect(find(page, submittedOpenId).displayState).toBe("submitted");
      expect(find(page, submittedOpenId).timing).toBe("no_deadline");
    });
  });

  describe("row contract", () => {
    it("returns pass, fail and not_evaluated results", async () => {
      const passId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "07:00",
      });
      await insertRecord(passId, {
        recordedAt: wallClockToInstant(daysAgo(1), "06:50", org.timeZone),
        temperature: { recordedC: "3.5", result: "ok" },
      });

      const failId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "08:00",
      });
      await insertRecord(failId, {
        recordedAt: wallClockToInstant(daysAgo(1), "07:50", org.timeZone),
        temperature: {
          recordedC: "9.1",
          result: "out_of_range",
          correctiveAction: "Moved stock to the walk-in",
        },
      });

      const missedId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "09:00",
      });

      const page = await listRecords();

      expect(find(page, passId).result).toBe("pass");
      expect(find(page, passId).record?.temperature).toMatchObject({
        recordedC: 3.5,
        minTempC: 0,
        maxTempC: 5,
        result: "ok",
      });
      expect(find(page, failId).result).toBe("fail");
      expect(find(page, failId).record?.temperature?.correctiveAction).toBe(
        "Moved stock to the walk-in",
      );
      expect(find(page, missedId).result).toBe("not_evaluated");
      expect(find(page, missedId).record).toBeNull();
    });

    it("keeps the retained temperature payload on a voided record", async () => {
      const voidedId = await insertOccurrence({ type: "temperature" });
      await insertRecord(voidedId, {
        recordedAt: wallClockToInstant(daysAgo(1), "07:50", org.timeZone),
        voidedAt: new Date(),
        voidedByUserId: org.admin.userId,
        temperature: { recordedC: "9.1", result: "out_of_range" },
      });

      const page = await listRecords();

      expect(find(page, voidedId)).toMatchObject({
        displayState: "voided",
        result: "fail",
      });
    });

    it("attributes the creator, the current recorder and the void actor separately", async () => {
      const occurrenceId = await insertOccurrence({ type: "cleaning" });
      await insertRecord(occurrenceId, {
        createdAt: wallClockToInstant(daysAgo(1), "07:00", org.timeZone),
        createdByUserId: org.employee.userId,
        recordedAt: wallClockToInstant(daysAgo(1), "07:30", org.timeZone),
        recordedByUserId: org.admin.userId,
        voidedAt: new Date(),
        voidedByUserId: org.employee.userId,
      });

      const detail = find(await listRecords(), occurrenceId).record!;

      expect(detail.createdBy?.id).toBe(org.employee.userId);
      expect(detail.recordedBy?.id).toBe(org.admin.userId);
      expect(detail.voidedBy?.id).toBe(org.employee.userId);
      expect(detail.createdBy?.firstName).toBe("Emil");
      expect(detail.recordedBy?.firstName).toBe("Ada");
    });

    it("returns the stored occurrence values, not the current template or equipment", async () => {
      const occurrenceId = await insertOccurrence({
        type: "temperature",
        title: "Morning fridge check",
      });

      await db
        .update(taskTemplates)
        .set({ title: "Renamed template" })
        .where(eq(taskTemplates.id, org.templates.temperature.id));
      await db
        .update(equipment)
        .set({ name: "Renamed fridge" })
        .where(eq(equipment.id, org.equipment.fridge.id));

      const item = find(await listRecords(), occurrenceId);

      expect(item.title).toBe("Morning fridge check");
      expect(item.equipmentName).toBe("Fridge 1");
      expect(item.equipmentId).toBe(org.equipment.fridge.id);
      expect(item.minTempC).toBe(0);
      expect(item.maxTempC).toBe(5);
      expect(item.taskTemplateId).toBe(org.templates.temperature.id);
    });
  });

  describe("paging", () => {
    async function seedOccurrences(count: number): Promise<void> {
      for (let index = 0; index < count; index += 1) {
        await insertOccurrence({
          type: "cleaning",
          scheduledTime: `${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`,
          title: `Task ${String(index).padStart(2, "0")}`,
        });
      }
    }

    it("defaults to page 1 with 25 rows", async () => {
      await seedOccurrences(30);

      const page = await listRecords();

      expect(page.items).toHaveLength(25);
      expect(page.total).toBe(30);
    });

    it("accepts every offered page size and rejects one above the cap", async () => {
      await seedOccurrences(12);

      for (const pageSize of [10, 25, 50, 100]) {
        const page = await listRecords({
          page: "1",
          pageSize: String(pageSize),
        });
        expect(page.items.length).toBe(Math.min(pageSize, 12));
      }

      const rejected = await apiRequest(
        recordsPath({ page: "1", pageSize: "101" }),
        { actor: asAdmin(org) },
      );
      expect(rejected.status).toBe(400);
    });

    it("returns an empty page beyond the last with the total intact", async () => {
      await seedOccurrences(12);

      const page = await listRecords({ page: "9", pageSize: "10" });

      expect(page.items).toEqual([]);
      expect(page.total).toBe(12);
    });

    it("pages forward and back without repeating or dropping a row", async () => {
      await seedOccurrences(30);

      const seen: string[] = [];
      for (const page of [1, 2, 3]) {
        const result = await listRecords({
          page: String(page),
          pageSize: "10",
        });
        seen.push(...result.items.map((item) => item.occurrenceId));
      }

      expect(seen).toHaveLength(30);
      expect(new Set(seen).size).toBe(30);

      const backToFirst = await listRecords({ page: "1", pageSize: "10" });
      expect(backToFirst.items.map((item) => item.occurrenceId)).toEqual(
        seen.slice(0, 10),
      );
    });

    it("keeps paging stable when every row shares a date and time", async () => {
      // (template, date, time) is unique, so equal-instant rows need distinct templates.
      const templates = await db
        .insert(taskTemplates)
        .values(
          Array.from({ length: 12 }, (_, index) => ({
            locationId: org.locations.main.id,
            title: `Tied template ${index}`,
            type: "cleaning",
            weekdays: [
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday",
            ],
            scheduledTimes: ["08:00"],
          })),
        )
        .returning({ id: taskTemplates.id });

      for (const [index, template] of templates.entries()) {
        await insertOccurrence({
          type: "cleaning",
          occurrenceDate: daysAgo(2),
          scheduledTime: "08:00",
          title: `Tied ${index}`,
          templateId: template.id,
        });
      }

      const first = await listRecords({ page: "1", pageSize: "5" });
      const second = await listRecords({ page: "2", pageSize: "5" });
      const third = await listRecords({ page: "3", pageSize: "5" });

      const ids = [...first.items, ...second.items, ...third.items].map(
        (item) => item.occurrenceId,
      );

      expect(ids).toHaveLength(12);
      expect(new Set(ids).size).toBe(12);
    });
  });

  describe("ordering", () => {
    beforeEach(async () => {
      await insertOccurrence({
        type: "cleaning",
        occurrenceDate: daysAgo(3),
        scheduledTime: "09:00",
        title: "Beta",
      });
      await insertOccurrence({
        type: "cleaning",
        occurrenceDate: daysAgo(2),
        scheduledTime: "07:00",
        title: "Alpha",
      });
      await insertOccurrence({
        type: "cleaning",
        occurrenceDate: daysAgo(2),
        scheduledTime: "18:00",
        title: "Gamma",
      });
    });

    it("orders scheduledAt ascending by default", async () => {
      expect(titles(await listRecords())).toEqual(["Beta", "Alpha", "Gamma"]);
    });

    it("reverses date and time together for scheduledAt descending", async () => {
      expect(
        titles(await listRecords({ sortBy: "scheduledAt", sortOrder: "desc" })),
      ).toEqual(["Gamma", "Alpha", "Beta"]);
    });

    it("orders by the stored title in both directions", async () => {
      expect(
        titles(await listRecords({ sortBy: "title", sortOrder: "asc" })),
      ).toEqual(["Alpha", "Beta", "Gamma"]);
      expect(
        titles(await listRecords({ sortBy: "title", sortOrder: "desc" })),
      ).toEqual(["Gamma", "Beta", "Alpha"]);
    });
  });

  describe("filters", () => {
    let temperaturePassId: string;
    let temperatureFailId: string;
    let temperatureMissedId: string;
    let cleaningVoidedId: string;

    beforeEach(async () => {
      temperaturePassId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "06:00",
      });
      await insertRecord(temperaturePassId, {
        recordedAt: wallClockToInstant(daysAgo(1), "05:50", org.timeZone),
        temperature: { recordedC: "3.5", result: "ok" },
      });

      temperatureFailId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "07:00",
      });
      await insertRecord(temperatureFailId, {
        recordedAt: wallClockToInstant(daysAgo(1), "06:50", org.timeZone),
        temperature: { recordedC: "9.5", result: "out_of_range" },
      });

      temperatureMissedId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "08:00",
      });

      cleaningVoidedId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "09:00",
      });
      await insertRecord(cleaningVoidedId, {
        recordedAt: wallClockToInstant(daysAgo(1), "08:50", org.timeZone),
        voidedAt: new Date(),
        voidedByUserId: org.admin.userId,
      });
    });

    it("filters by type", async () => {
      const page = await listRecords({ type: "cleaning" });

      expect(page.items.map((item) => item.occurrenceId)).toEqual([
        cleaningVoidedId,
      ]);
      expect(page.total).toBe(1);
    });

    it("ORs multiple values inside the type filter", async () => {
      const otherId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "11:00",
        templateId: org.templates.cleaning.id,
        title: "Other work",
      });

      const page = await listRecords({ type: "cleaning,temperature" });
      const ids = page.items.map((item) => item.occurrenceId);

      expect(ids).toContain(otherId);
      expect(ids).toContain(cleaningVoidedId);
      expect(ids).toContain(temperaturePassId);
      expect(page.total).toBe(5);
    });

    it("ORs multiple values inside the status filter", async () => {
      const page = await listRecords({ state: "missed,voided" });
      const ids = page.items.map((item) => item.occurrenceId);

      expect(ids).toContain(temperatureMissedId);
      expect(ids).toContain(cleaningVoidedId);
      expect(ids).not.toContain(temperaturePassId);
      expect(page.total).toBe(2);
    });

    it("filters by temperature result, including not_evaluated", async () => {
      expect(
        (await listRecords({ result: "pass" })).items.map(
          (item) => item.occurrenceId,
        ),
      ).toEqual([temperaturePassId]);

      expect(
        (await listRecords({ result: "fail" })).items.map(
          (item) => item.occurrenceId,
        ),
      ).toEqual([temperatureFailId]);

      const notEvaluated = (
        await listRecords({ result: "not_evaluated" })
      ).items.map((item) => item.occurrenceId);
      expect(notEvaluated).toContain(temperatureMissedId);
      expect(notEvaluated).toContain(cleaningVoidedId);
      expect(notEvaluated).not.toContain(temperaturePassId);

      expect((await listRecords({ result: "pass,fail" })).total).toBe(2);
    });

    it("ANDs different filters together", async () => {
      expect(
        (
          await listRecords({ type: "temperature", state: "submitted" })
        ).items.map((item) => item.occurrenceId),
      ).toEqual([temperaturePassId, temperatureFailId]);

      expect(
        (await listRecords({ type: "temperature", result: "fail" })).items.map(
          (item) => item.occurrenceId,
        ),
      ).toEqual([temperatureFailId]);

      expect(
        (await listRecords({ type: "cleaning", state: "submitted" })).total,
      ).toBe(0);
    });

    it("accepts voided combined with a failed reading", async () => {
      const voidedFailId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "10:00",
      });
      await insertRecord(voidedFailId, {
        recordedAt: wallClockToInstant(daysAgo(1), "09:50", org.timeZone),
        voidedAt: new Date(),
        voidedByUserId: org.admin.userId,
        temperature: { recordedC: "9.9", result: "out_of_range" },
      });

      expect(
        (await listRecords({ state: "voided", result: "fail" })).items.map(
          (item) => item.occurrenceId,
        ),
      ).toEqual([voidedFailId]);
    });
  });

  describe("totals", () => {
    beforeEach(async () => {
      const submittedId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "06:00",
      });
      await insertRecord(submittedId, {
        recordedAt: wallClockToInstant(daysAgo(1), "05:50", org.timeZone),
        temperature: { recordedC: "3.5", result: "ok" },
      });
      await insertOccurrence({ type: "cleaning", scheduledTime: "07:00" });
      await insertOccurrence({ type: "cleaning", scheduledTime: "08:00" });
    });

    it("counts everything eligible in range, then narrows under a filter", async () => {
      const unfiltered = await listRecords();
      expect(unfiltered.total).toBe(3);

      const filtered = await listRecords({ type: "temperature" });
      expect(filtered.total).toBe(1);
    });

    it("returns a zero total and an empty page for a range with no eligible work", async () => {
      const page = await listRecords({
        dateFrom: "2019-01-01",
        dateTo: "2019-01-31",
      });

      expect(page).toEqual({ items: [], total: 0 });
    });

    it("returns every eligible row on one page when it fits", async () => {
      const page = await listRecords({ pageSize: "100", page: "1" });

      expect(page.items).toHaveLength(page.total);
    });
  });

  describe("organization-local dates", () => {
    it("filters by the stored local calendar date, not the UTC instant", async () => {
      const localDate = daysAgo(3);
      // 00:30 Sofia is the previous day in UTC.
      const occurrenceId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: localDate,
        scheduledTime: "00:30",
      });

      const inRange = await listRecords({
        dateFrom: localDate,
        dateTo: localDate,
      });
      expect(inRange.items.map((item) => item.occurrenceId)).toEqual([
        occurrenceId,
      ]);

      const dayBefore = addCalendarDays(localDate, -1);
      const outOfRange = await listRecords({
        dateFrom: dayBefore,
        dateTo: dayBefore,
      });
      expect(outOfRange.items).toEqual([]);
    });

    it("returns rows around both Sofia DST transitions", async () => {
      const spring = lastSundayOfMonth(lastPast("03-15"));
      const autumn = lastSundayOfMonth(lastPast("10-15"));

      const springId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: spring,
        scheduledTime: "03:30",
      });
      const autumnId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: autumn,
        scheduledTime: "03:30",
        templateId: org.templates.temperature.id,
      });

      const springPage = await listRecords({
        dateFrom: spring,
        dateTo: spring,
      });
      const autumnPage = await listRecords({
        dateFrom: autumn,
        dateTo: autumn,
      });

      expect(find(springPage, springId).occurrenceDate).toBe(spring);
      expect(find(springPage, springId).scheduledTime).toBe("03:30");
      expect(find(autumnPage, autumnId).occurrenceDate).toBe(autumn);
    });

    it("accepts a historical range longer than two months", async () => {
      const start = addCalendarDays(today(), -75);
      await insertOccurrence({ type: "cleaning", occurrenceDate: start });
      await insertOccurrence({
        type: "cleaning",
        occurrenceDate: daysAgo(40),
        templateId: org.templates.temperature.id,
      });

      const page = await listRecords({ dateFrom: start, dateTo: today() });

      expect(page.total).toBe(2);
    });
  });

  describe("query cost", () => {
    it("does not add a query per row for actor attribution", async () => {
      // Warm the tenant/membership caches so only the Records queries are counted.
      await listRecords();

      const single = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "06:00",
      });
      await insertRecord(single, { recordedAt: new Date() });

      const selectSpy = vi.spyOn(db, "select");
      await listRecords();
      const oneRowSelects = selectSpy.mock.calls.length;
      selectSpy.mockClear();

      for (let index = 1; index <= 10; index += 1) {
        const occurrenceId = await insertOccurrence({
          type: "cleaning",
          scheduledTime: `${String(6 + index).padStart(2, "0")}:00`,
        });
        await insertRecord(occurrenceId, {
          recordedAt: new Date(),
          createdByUserId:
            index % 2 === 0 ? org.admin.userId : org.employee.userId,
          recordedByUserId:
            index % 2 === 0 ? org.employee.userId : org.admin.userId,
        });
      }

      selectSpy.mockClear();
      const manyRows = await listRecords();

      expect(manyRows.items.length).toBe(11);
      expect(selectSpy.mock.calls.length).toBe(oneRowSelects);
      expect(oneRowSelects).toBeLessThanOrEqual(2);
      for (const item of manyRows.items) {
        expect(item.record?.recordedBy).not.toBeNull();
      }
    });
  });

  describe("authorization", () => {
    let world: TwoTenantWorld;

    it("allows an organization admin", async () => {
      const response = await apiRequest(recordsPath({}), {
        actor: asAdmin(org),
      });
      expect(response.status).toBe(200);
    });

    it("denies an employee, even for their own assigned location", async () => {
      const response = await apiRequest(recordsPath({}), {
        actor: asEmployee(org),
      });
      expect(response.status).toBe(403);
    });

    it("allows an admin any location in their organization", async () => {
      const response = await apiRequest(
        recordsPath({}, org.locations.annex.id),
        { actor: asAdmin(org) },
      );
      expect(response.status).toBe(200);
    });

    it("denies an employee a location they are not assigned to", async () => {
      const response = await apiRequest(
        recordsPath({}, org.locations.annex.id),
        { actor: asEmployee(org) },
      );
      expect(response.status).toBe(403);
    });

    it("denies an unknown location in the same organization", async () => {
      const response = await apiRequest(
        recordsPath({}, "00000000-0000-4000-8000-000000000000"),
        { actor: asAdmin(org) },
      );
      expect(response.status).toBe(403);
    });

    it("denies another tenant's location", async () => {
      world = await seedTwoTenants(db);

      const response = await apiRequest(
        `/locations/${world.beta.locations.main.id}/records?dateFrom=${zonedDateString(new Date(), world.alpha.timeZone)}&dateTo=${zonedDateString(new Date(), world.alpha.timeZone)}`,
        { actor: asAdmin(world.alpha) },
      );

      expect(response.status).toBe(403);
    });

    it("rejects an anonymous request", async () => {
      const response = await apiRequest(recordsPath({}));
      expect(response.status).toBe(401);
    });
  });

  describe("validation", () => {
    // Built lazily: `today()` needs the organization seeded by beforeEach.
    it.each([
      ["a missing range", () => ({ dateFrom: null, dateTo: null })],
      ["only dateFrom", () => ({ dateTo: null })],
      ["a reversed range", () => ({ dateFrom: today(), dateTo: daysAgo(3) })],
      ["a malformed date", () => ({ dateFrom: "2026-8-1" })],
      ["a non-existent date", () => ({ dateFrom: "2026-02-30" })],
      ["a search parameter", () => ({ search: "fridge" })],
      ["an unknown parameter", () => ({ limit: "10" })],
      ["an unlisted sort field", () => ({ sortBy: "status" })],
      ["an invalid sort direction", () => ({ sortOrder: "sideways" })],
      ["an unknown type value", () => ({ type: "delivery" })],
      ["a pending status value", () => ({ state: "pending" })],
      ["an unknown result value", () => ({ result: "unknown" })],
      ["page without pageSize", () => ({ page: "2" })],
      ["a page size above the cap", () => ({ page: "1", pageSize: "101" })],
    ] as [string, () => Record<string, string | null>][])(
      "rejects %s",
      async (_label, buildQuery) => {
        const params = new URLSearchParams({
          dateFrom: daysAgo(6),
          dateTo: today(),
        });

        for (const [key, value] of Object.entries(buildQuery())) {
          if (value === null) {
            params.delete(key);
          } else {
            params.set(key, value);
          }
        }

        const response = await apiRequest(
          `/locations/${org.locations.main.id}/records?${params.toString()}`,
          { actor: asAdmin(org) },
        );

        expect(response.status).toBe(400);
      },
    );

    it("rejects a dateTo after the organization's local today", async () => {
      const response = await apiRequest(
        recordsPath({ dateTo: addCalendarDays(today(), 1) }),
        { actor: asAdmin(org) },
      );

      expect(response.status).toBe(400);
    });

    it("accepts a range ending exactly on the organization's local today", async () => {
      const response = await apiRequest(
        recordsPath({ dateFrom: today(), dateTo: today() }),
        { actor: asAdmin(org) },
      );

      expect(response.status).toBe(200);
    });
  });
});
