import {
  addCalendarDays,
  compareCalendarDates,
  endOfCalendarMonth,
  getWeekdayFromDate,
  recordsFilterOptionsResponseSchema,
  recordsJournalsResponseSchema,
  recordsListResponseSchema,
  recordsReportResponseSchema,
  wallClockToInstant,
  zonedDateString,
  type RecordItem,
  type RecordsListResponse,
  type RecordsReportOk,
  type RecordsReportResponse,
} from "@haccp/shared";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../src/core/db/client.js";
import {
  formVersions,
  forms,
  targets,
  taskOccurrences,
  taskRecords,
  taskTemplates,
} from "../../src/core/db/schema/index.js";
import {
  CLEANING_DEFINITION,
  CLEANING_FIELD_ID,
  FRIDGE_FIELD_ID,
  recordContextFor,
  seedOrganization,
  seedTwoTenants,
  type SeededOrg,
  type TwoTenantWorld,
} from "./harness/fixtures.js";
import { recordsRepository } from "../../src/modules/records/records.repository.js";
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
    formVersionId?: string;
    target?: { id: string; name: string } | null;
  }): Promise<string> {
    const locationId = overrides.locationId ?? org.locations.main.id;
    const occurrenceDate = overrides.occurrenceDate ?? daysAgo(1);
    const scheduledTime = overrides.scheduledTime ?? "08:00";
    const isTemperature = overrides.type === "temperature";
    const target =
      overrides.target === undefined
        ? isTemperature
          ? org.targets.fridge
          : null
        : overrides.target;

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
        formVersionId:
          overrides.formVersionId ??
          (isTemperature
            ? org.forms.fridgeCheck.versionId
            : org.forms.cleaning.versionId),
        targetId: target?.id ?? null,
        targetName: target?.name ?? null,
        resolvedLimits: isTemperature
          ? { [FRIDGE_FIELD_ID]: { min: 0, max: 5 } }
          : {},
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
    const reading = overrides.temperature;

    const [record] = await db
      .insert(taskRecords)
      .values({
        ...(await recordContextFor(db, occurrenceId)),
        values: reading
          ? {
              [FRIDGE_FIELD_ID]: {
                type: "measurement",
                value: Number(reading.recordedC),
                unit: "celsius",
                min: 0,
                max: 5,
                fails: reading.result === "out_of_range",
              },
            }
          : { [CLEANING_FIELD_ID]: { type: "checkbox", value: true } },
        result: reading
          ? reading.result === "ok"
            ? "pass"
            : "fail"
          : "not_evaluated",
        correctiveAction: reading?.correctiveAction ?? null,
        createdAt: overrides.createdAt ?? overrides.recordedAt,
        createdByUserId: overrides.createdByUserId ?? org.admin.userId,
        recordedAt: overrides.recordedAt,
        recordedByUserId: overrides.recordedByUserId ?? org.employee.userId,
        voidedAt: overrides.voidedAt ?? null,
        voidedByUserId: overrides.voidedByUserId ?? null,
      })
      .returning({ id: taskRecords.id });

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
      expect(find(page, passId).record?.values[FRIDGE_FIELD_ID]).toMatchObject({
        value: 3.5,
        min: 0,
        max: 5,
        fails: false,
      });
      expect(find(page, failId).result).toBe("fail");
      expect(find(page, failId).record?.correctiveAction).toBe(
        "Moved stock to the walk-in",
      );
      expect(find(page, missedId).result).toBe("not_evaluated");
      expect(find(page, missedId).record).toBeNull();
      expect(page.formVersions[find(page, passId).formVersionId]).toMatchObject(
        {
          formName: "Fridge check",
          category: "temperature",
          // A printed journal is shaped by these and filed under the version's edition date.
          appliesTo: "per_item",
          onDemand: false,
          version: 1,
          publishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
        },
      );
    });

    it("keeps the answers and result on a voided record", async () => {
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
      expect(
        find(page, voidedId).record?.values[FRIDGE_FIELD_ID],
      ).toMatchObject({
        value: 9.1,
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

    it("returns the stored occurrence values, not the current form or target", async () => {
      const occurrenceId = await insertOccurrence({
        type: "temperature",
        title: "Morning fridge check",
      });

      await db
        .update(forms)
        .set({ name: "Renamed form" })
        .where(eq(forms.id, org.forms.fridgeCheck.id));
      await db
        .update(targets)
        .set({ name: "Renamed fridge" })
        .where(eq(targets.id, org.targets.fridge.id));

      const item = find(await listRecords(), occurrenceId);

      expect(item.title).toBe("Morning fridge check");
      expect(item.targetName).toBe("Fridge 1");
      expect(item.targetId).toBe(org.targets.fridge.id);
      expect(item.resolvedLimits).toEqual({
        [FRIDGE_FIELD_ID]: { min: 0, max: 5 },
      });
      expect(item.category).toBe("temperature");
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
        seen.push(...result.items.map((item) => item.id));
      }

      expect(seen).toHaveLength(30);
      expect(new Set(seen).size).toBe(30);

      const backToFirst = await listRecords({ page: "1", pageSize: "10" });
      expect(backToFirst.items.map((item) => item.id)).toEqual(
        seen.slice(0, 10),
      );
    });

    it("keeps paging stable when every row shares a date and time", async () => {
      // (template, date, time) is unique, so equal-instant rows need distinct templates.
      const templates = await db
        .insert(taskTemplates)
        .values(
          Array.from({ length: 12 }, () => ({
            locationId: org.locations.main.id,
            formId: org.forms.cleaning.id,
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

    it("orders entryAt ascending by default", async () => {
      expect(titles(await listRecords())).toEqual(["Beta", "Alpha", "Gamma"]);
    });

    it("reverses date and time together for entryAt descending", async () => {
      expect(
        titles(await listRecords({ sortBy: "entryAt", sortOrder: "desc" })),
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

    it("filters by form category", async () => {
      const page = await listRecords({ category: "cleaning" });

      expect(page.items.map((item) => item.occurrenceId)).toEqual([
        cleaningVoidedId,
      ]);
      expect(page.total).toBe(1);
    });

    it("ORs multiple values inside the category filter", async () => {
      const otherId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "11:00",
        templateId: org.templates.cleaning.id,
        title: "Other work",
      });

      const page = await listRecords({ category: "cleaning,temperature" });
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

    it("filters by result, including not_evaluated", async () => {
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
          await listRecords({ category: "temperature", state: "submitted" })
        ).items.map((item) => item.occurrenceId),
      ).toEqual([temperaturePassId, temperatureFailId]);

      expect(
        (
          await listRecords({ category: "temperature", result: "fail" })
        ).items.map((item) => item.occurrenceId),
      ).toEqual([temperatureFailId]);

      expect(
        (await listRecords({ category: "cleaning", state: "submitted" })).total,
      ).toBe(0);
    });

    it("filters by check, across both union branches", async () => {
      const page = await listRecords({ form: org.forms.fridgeCheck.id });

      expect(page.items.map((item) => item.occurrenceId)).toEqual([
        temperaturePassId,
        temperatureFailId,
        temperatureMissedId,
      ]);
      expect(page.total).toBe(3);
    });

    it("filters by item, keeping missed checks of that item", async () => {
      const page = await listRecords({ target: org.targets.fridge.id });
      const ids = page.items.map((item) => item.occurrenceId);

      expect(ids).toContain(temperatureMissedId);
      expect(ids).not.toContain(cleaningVoidedId);
      expect(page.total).toBe(3);
    });

    it("filters by who recorded, which leaves out checks nobody recorded", async () => {
      const byAdminId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "10:00",
      });
      await insertRecord(byAdminId, {
        recordedAt: wallClockToInstant(daysAgo(1), "09:55", org.timeZone),
        recordedByUserId: org.admin.userId,
        temperature: { recordedC: "2.0", result: "ok" },
      });

      const byAdmin = await listRecords({ recordedBy: org.admin.userId });
      expect(byAdmin.items.map((item) => item.occurrenceId)).toEqual([
        byAdminId,
      ]);
      expect(byAdmin.total).toBe(1);

      const byEmployee = await listRecords({
        recordedBy: org.employee.userId,
        form: org.forms.fridgeCheck.id,
      });
      expect(byEmployee.items.map((item) => item.occurrenceId)).toEqual([
        temperaturePassId,
        temperatureFailId,
      ]);
    });

    it("returns nothing, not an error, for another tenant's check, item or person", async () => {
      const other = await seedOrganization(db, { slug: "records-other" });

      const queries: Record<string, string>[] = [
        { form: other.forms.fridgeCheck.id },
        { target: other.targets.fridge.id },
        { recordedBy: other.employee.userId },
      ];
      for (const query of queries) {
        const page = await listRecords(query);
        expect(page).toEqual({ items: [], total: 0, formVersions: {} });

        const params = new URLSearchParams({
          dateFrom: daysAgo(6),
          dateTo: today(),
          ...query,
        }).toString();
        const base = `/locations/${org.locations.main.id}/records`;

        const journals = await apiRequest(`${base}/journals?${params}`, {
          actor: asAdmin(org),
        });
        expect(journals.status).toBe(200);
        expect(await journals.json()).toEqual({ items: [] });

        const report = await apiRequest(`${base}/report?${params}`, {
          actor: asAdmin(org),
        });
        expect(report.status).toBe(200);
        const reportBody = await report.json();
        expect(reportBody).not.toHaveProperty("error");
        expect(reportBody).not.toHaveProperty("details");
        expect(reportBody).toMatchObject({ items: [], total: 0 });
      }
    });

    it("applies the new filters to the report exactly as to the grid", async () => {
      const query = { target: org.targets.fridge.id, state: "submitted" };
      const grid = await listRecords({ ...query, pageSize: "100", page: "1" });

      const response = await apiRequest(
        `/locations/${org.locations.main.id}/records/report?${new URLSearchParams(
          { dateFrom: daysAgo(6), dateTo: today(), ...query },
        ).toString()}`,
        { actor: asAdmin(org) },
      );
      const report = recordsReportResponseSchema.parse(
        await response.json(),
      ) as RecordsReportOk;

      expect(report.items.map((item) => item.id)).toEqual(
        grid.items.map((item) => item.id),
      );
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

  describe("journals", () => {
    function journalsPath(query: Record<string, string> = {}): string {
      return `/locations/${org.locations.main.id}/records/journals?${new URLSearchParams(
        { dateFrom: daysAgo(6), dateTo: today(), ...query },
      ).toString()}`;
    }

    beforeEach(async () => {
      const passId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "06:00",
      });
      await insertRecord(passId, {
        recordedAt: wallClockToInstant(daysAgo(1), "05:50", org.timeZone),
        temperature: { recordedC: "3.5", result: "ok" },
      });
      await insertOccurrence({ type: "temperature", scheduledTime: "07:00" });
      await insertOccurrence({ type: "cleaning", scheduledTime: "08:00" });
    });

    it("counts each check's rows across records and missed checks", async () => {
      const response = await apiRequest(journalsPath(), {
        actor: asAdmin(org),
      });

      expect(response.status).toBe(200);
      const body = recordsJournalsResponseSchema.parse(await response.json());
      expect(body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            formId: org.forms.fridgeCheck.id,
            total: 2,
          }),
          expect.objectContaining({ formId: org.forms.cleaning.id, total: 1 }),
        ]),
      );
      expect(body.items).toHaveLength(2);
    });

    it("matches the grid's total for every check it returns", async () => {
      const filterSets: Record<string, string>[] = [{}, { state: "submitted" }];
      for (const filters of filterSets) {
        const body = recordsJournalsResponseSchema.parse(
          await (
            await apiRequest(journalsPath(filters), { actor: asAdmin(org) })
          ).json(),
        );
        expect(body.items.length).toBeGreaterThan(0);

        for (const item of body.items) {
          const list = await listRecords({ ...filters, form: item.formId });
          expect(list.total).toBe(item.total);
        }
      }
    });

    it("applies the grid's filters, so it only offers checks with rows", async () => {
      const response = await apiRequest(journalsPath({ state: "submitted" }), {
        actor: asAdmin(org),
      });
      const body = recordsJournalsResponseSchema.parse(await response.json());

      expect(body.items).toEqual([
        expect.objectContaining({ formId: org.forms.fridgeCheck.id, total: 1 }),
      ]);
    });

    it("is admin-only and validates the range like the report", async () => {
      expect(
        (await apiRequest(journalsPath(), { actor: asEmployee(org) })).status,
      ).toBe(403);
      expect(
        (
          await apiRequest(
            journalsPath({ dateTo: addCalendarDays(today(), 1) }),
            {
              actor: asAdmin(org),
            },
          )
        ).status,
      ).toBe(400);
    });
  });

  function yesterdayAt(time: string): Date {
    return wallClockToInstant(daysAgo(1), time, org.timeZone);
  }

  async function insertTarget(values: {
    kind: "equipment" | "area" | "component";
    name: string;
    parentId?: string;
    archivedAt?: Date;
  }): Promise<{ id: string; name: string }> {
    const [target] = await db
      .insert(targets)
      .values({ locationId: org.locations.main.id, ...values })
      .returning({ id: targets.id, name: targets.name });
    return target!;
  }

  async function insertPerItemForm(
    name: string,
  ): Promise<{ id: string; versionId: string }> {
    const [form] = await db
      .insert(forms)
      .values({
        organizationId: org.organizationId,
        name,
        category: "cleaning",
        appliesTo: "per_item",
      })
      .returning({ id: forms.id });
    const [version] = await db
      .insert(formVersions)
      .values({ formId: form!.id, version: 1, definition: CLEANING_DEFINITION })
      .returning({ id: formVersions.id });
    return { id: form!.id, versionId: version!.id };
  }

  function subPath(
    endpoint: "report" | "journals",
    query: Record<string, string> = {},
  ): string {
    return `/locations/${org.locations.main.id}/records/${endpoint}?${new URLSearchParams(
      { dateFrom: daysAgo(6), dateTo: today(), ...query },
    ).toString()}`;
  }

  async function getOkReport(
    query: Record<string, string> = {},
  ): Promise<RecordsReportOk> {
    const response = await apiRequest(subPath("report", query), {
      actor: asAdmin(org),
    });
    expect(response.status).toBe(200);
    const report = recordsReportResponseSchema.parse(await response.json());
    expect(report.status).toBe("ok");
    return report as RecordsReportOk;
  }

  async function getJournals(query: Record<string, string> = {}) {
    const response = await apiRequest(subPath("journals", query), {
      actor: asAdmin(org),
    });
    expect(response.status).toBe(200);
    return recordsJournalsResponseSchema.parse(await response.json());
  }

  describe("late timing filter", () => {
    let lateId: string;
    let onTimeId: string;
    let atDeadlineId: string;

    beforeEach(async () => {
      lateId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "07:00",
      });
      await insertRecord(lateId, { recordedAt: yesterdayAt("07:30") });

      onTimeId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "08:00",
      });
      await insertRecord(onTimeId, { recordedAt: yesterdayAt("07:55") });

      atDeadlineId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "09:00",
      });
      await insertRecord(atDeadlineId, { recordedAt: yesterdayAt("09:00") });

      const voidedLateId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "10:00",
      });
      await insertRecord(voidedLateId, {
        recordedAt: yesterdayAt("10:30"),
        voidedAt: new Date(),
        voidedByUserId: org.admin.userId,
      });

      const noDeadlineId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "11:00",
        dueAt: null,
      });
      await insertRecord(noDeadlineId, { recordedAt: yesterdayAt("23:00") });

      await insertOccurrence({ type: "cleaning", scheduledTime: "12:00" });
    });

    it("lists only submitted records made after their deadline", async () => {
      const page = await listRecords({ timing: "late" });

      expect(page.items.map((item) => item.occurrenceId)).toEqual([lateId]);
      expect(page.items[0]!.timing).toBe("late");
      expect(page.total).toBe(1);
    });

    it("selects exactly the rows the list labels late", async () => {
      const all = await listRecords();
      expect(all.total).toBe(6);

      expect(
        (await listRecords({ timing: "late" })).items.map((item) => item.id),
      ).toEqual(
        all.items
          .filter((item) => item.timing === "late")
          .map((item) => item.id),
      );
      expect(find(all, onTimeId).timing).toBe("on_time");
      expect(find(all, atDeadlineId).timing).toBe("on_time");
    });

    it("never matches an unrecorded check and composes with the other filters", async () => {
      expect(
        (await listRecords({ timing: "late", state: "missed" })).total,
      ).toBe(0);
      expect(
        (
          await listRecords({ timing: "late", state: "submitted,missed" })
        ).items.map((item) => item.occurrenceId),
      ).toEqual([lateId]);
      expect(
        (await listRecords({ timing: "late", category: "temperature" })).total,
      ).toBe(0);
    });

    it("applies to the report and the journals as to the grid", async () => {
      const report = await getOkReport({ timing: "late" });
      expect(report.items.map((item) => item.occurrenceId)).toEqual([lateId]);
      expect(report.total).toBe(1);

      expect((await getJournals({ timing: "late" })).items).toEqual([
        expect.objectContaining({ formId: org.forms.cleaning.id, total: 1 }),
      ]);
    });
  });

  describe("excluded items", () => {
    let freezer: { id: string; name: string };
    let hygiene: { id: string; versionId: string };
    let fridgeOnFridgeId: string;
    let fridgeOnFreezerId: string;
    let hygieneOnFridgeId: string;
    let cleaningId: string;

    beforeEach(async () => {
      freezer = await insertTarget({ kind: "equipment", name: "Freezer" });
      hygiene = await insertPerItemForm("Fridge hygiene");

      fridgeOnFridgeId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "06:00",
      });
      fridgeOnFreezerId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "07:00",
        target: freezer,
      });
      await insertRecord(fridgeOnFreezerId, {
        recordedAt: yesterdayAt("06:55"),
        temperature: { recordedC: "-18", result: "ok" },
      });
      hygieneOnFridgeId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "08:00",
        formVersionId: hygiene.versionId,
        target: org.targets.fridge,
      });
      await insertRecord(hygieneOnFridgeId, {
        recordedAt: yesterdayAt("07:55"),
      });
      cleaningId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "09:00",
      });
    });

    it("leaves out one check's item and keeps another check's rows for it", async () => {
      expect(
        (await getOkReport()).items.map((item) => item.occurrenceId),
      ).toContain(fridgeOnFridgeId);

      const report = await getOkReport({
        exclude: `${org.forms.fridgeCheck.id}:${org.targets.fridge.id}`,
      });

      expect(report.items.map((item) => item.occurrenceId)).toEqual([
        fridgeOnFreezerId,
        hygieneOnFridgeId,
        cleaningId,
      ]);
      expect(report.total).toBe(report.items.length);
    });

    it("leaves out every listed pair and never a row with no item", async () => {
      const report = await getOkReport({
        exclude: [
          `${org.forms.fridgeCheck.id}:${org.targets.fridge.id}`,
          `${hygiene.id}:${org.targets.fridge.id}`,
          `${org.forms.cleaning.id}:${freezer.id}`,
        ].join(","),
      });

      expect(report.items.map((item) => item.occurrenceId)).toEqual([
        fridgeOnFreezerId,
        cleaningId,
      ]);
      expect(report.total).toBe(2);
    });

    it("is ignored by the journals, which offer every item to choose from", async () => {
      const exclude = `${org.forms.fridgeCheck.id}:${org.targets.fridge.id}`;

      expect(await getJournals({ exclude })).toEqual(await getJournals());
      expect(
        (await getJournals({ exclude })).items.find(
          (item) => item.formId === org.forms.fridgeCheck.id,
        )!.total,
      ).toBe(2);
    });

    it("rejects a malformed pair", async () => {
      for (const exclude of [org.forms.fridgeCheck.id, "not-a-uuid:also-not"]) {
        expect(
          (
            await apiRequest(subPath("report", { exclude }), {
              actor: asAdmin(org),
            })
          ).status,
        ).toBe(400);
      }
    });
  });

  describe("journal items", () => {
    let area: { id: string; name: string };
    let walls: { id: string; name: string };
    let freezer: { id: string; name: string };

    beforeEach(async () => {
      area = await insertTarget({ kind: "area", name: "Cold room" });
      walls = await insertTarget({
        kind: "component",
        name: "Walls",
        parentId: area.id,
      });
      freezer = await insertTarget({
        kind: "equipment",
        name: "Freezer",
        archivedAt: new Date(),
      });

      const recordedId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "06:00",
      });
      await insertRecord(recordedId, {
        recordedAt: yesterdayAt("05:55"),
        temperature: { recordedC: "3.0", result: "ok" },
      });
      await insertOccurrence({ type: "temperature", scheduledTime: "07:00" });
      await insertOccurrence({
        type: "temperature",
        scheduledTime: "08:00",
        target: freezer,
      });
      await insertOccurrence({
        type: "temperature",
        scheduledTime: "09:00",
        target: { id: walls.id, name: "Cold room › Walls" },
      });
      await insertOccurrence({
        type: "temperature",
        scheduledTime: "10:00",
        target: area,
      });
      await insertOccurrence({ type: "cleaning", scheduledTime: "11:00" });
      await insertOccurrence({ type: "cleaning", scheduledTime: "12:00" });

      // The dialog names an item as it is now, not as the rows snapshot it.
      await db
        .update(targets)
        .set({ name: "Display fridge" })
        .where(eq(targets.id, org.targets.fridge.id));
    });

    it("counts each item of a check, components under their area", async () => {
      const { items } = await getJournals();

      expect(items).toEqual([
        {
          formId: org.forms.cleaning.id,
          name: "Cleaning",
          total: 2,
          targets: [],
        },
        {
          formId: org.forms.fridgeCheck.id,
          name: "Fridge check",
          total: 5,
          targets: [
            {
              targetId: area.id,
              name: "Cold room",
              kind: "area",
              areaName: null,
              total: 1,
            },
            {
              targetId: walls.id,
              name: "Walls",
              kind: "component",
              areaName: "Cold room",
              total: 1,
            },
            {
              targetId: org.targets.fridge.id,
              name: "Display fridge",
              kind: "equipment",
              areaName: null,
              total: 2,
            },
            {
              targetId: freezer.id,
              name: "Freezer",
              kind: "equipment",
              areaName: null,
              total: 1,
            },
          ],
        },
      ]);
    });

    it("matches the grid's total for every item it offers", async () => {
      const { items } = await getJournals({ state: "missed" });
      const fridgeJournal = items.find(
        (item) => item.formId === org.forms.fridgeCheck.id,
      )!;
      expect(fridgeJournal.total).toBe(4);

      for (const target of fridgeJournal.targets) {
        const list = await listRecords({
          state: "missed",
          form: fridgeJournal.formId,
          target: target.targetId,
        });
        expect(list.total).toBe(target.total);
      }
    });
  });

  describe("outcome filter", () => {
    let passId: string;
    let failId: string;
    let lateFailId: string;
    let voidedFailId: string;
    let missedId: string;
    let openId: string;
    let recordedId: string;

    function ids(page: RecordsListResponse): (string | null)[] {
      return page.items.map((item) => item.occurrenceId);
    }

    beforeEach(async () => {
      passId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "06:00",
      });
      await insertRecord(passId, {
        recordedAt: yesterdayAt("05:50"),
        temperature: { recordedC: "3.0", result: "ok" },
      });

      failId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "07:00",
      });
      await insertRecord(failId, {
        recordedAt: yesterdayAt("06:50"),
        temperature: { recordedC: "9.0", result: "out_of_range" },
      });

      lateFailId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "08:00",
      });
      await insertRecord(lateFailId, {
        recordedAt: yesterdayAt("08:30"),
        temperature: { recordedC: "9.5", result: "out_of_range" },
      });

      voidedFailId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "09:00",
      });
      await insertRecord(voidedFailId, {
        recordedAt: yesterdayAt("09:30"),
        voidedAt: new Date(),
        voidedByUserId: org.admin.userId,
        temperature: { recordedC: "9.9", result: "out_of_range" },
      });

      missedId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "10:00",
      });
      openId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "11:00",
        dueAt: null,
      });

      recordedId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "12:00",
      });
      await insertRecord(recordedId, {
        recordedAt: yesterdayAt("12:30"),
        recordedByUserId: org.admin.userId,
      });
    });

    it("returns exactly the rows of each outcome, a voided failure only as voided", async () => {
      const expected: Record<string, string[]> = {
        passed: [passId],
        attention: [failId, lateFailId],
        recorded: [recordedId],
        missed: [missedId],
        voided: [voidedFailId],
        open: [openId],
      };

      for (const [outcome, rows] of Object.entries(expected)) {
        const page = await listRecords({ outcome });
        expect(ids(page), outcome).toEqual(rows);
        expect(page.total, outcome).toBe(rows.length);
      }
    });

    it("partitions every row: all six outcomes together are the whole list", async () => {
      const all = await listRecords();
      const page = await listRecords({
        outcome: "passed,attention,recorded,missed,voided,open",
      });

      expect(ids(page)).toEqual(ids(all));
      expect(page.total).toBe(7);
    });

    it("ORs the selected outcomes across both branches", async () => {
      const page = await listRecords({ outcome: "attention,missed" });

      expect(ids(page)).toEqual([failId, lateFailId, missedId]);
      expect(page.total).toBe(3);
    });

    it("ANDs with the other filters", async () => {
      const late = await listRecords({ outcome: "attention", timing: "late" });
      expect(ids(late)).toEqual([lateFailId]);
      expect(late.total).toBe(1);

      const cleaning = await listRecords({
        outcome: "attention,recorded,open",
        category: "cleaning",
      });
      expect(ids(cleaning)).toEqual([openId, recordedId]);
      expect(cleaning.total).toBe(2);

      const byEmployee = await listRecords({
        outcome: "passed,missed",
        recordedBy: org.employee.userId,
      });
      expect(ids(byEmployee)).toEqual([passId]);
      expect(byEmployee.total).toBe(1);

      const voidedPass = await listRecords({
        outcome: "voided",
        result: "pass",
      });
      expect(voidedPass.total).toBe(0);
      expect(voidedPass.items).toEqual([]);
    });

    it("is a grid filter only: the report and the journals reject it", async () => {
      for (const endpoint of ["report", "journals"] as const) {
        for (const query of [
          { outcome: "missed" },
          { search: "Fridge" },
        ] as Record<string, string>[]) {
          expect(
            (
              await apiRequest(subPath(endpoint, query), {
                actor: asAdmin(org),
              })
            ).status,
            `${endpoint} ${JSON.stringify(query)}`,
          ).toBe(400);
        }
      }
    });
  });

  describe("search", () => {
    let coolerId: string;
    let freezerId: string;
    let floorId: string;
    let handWashId: string;

    beforeEach(async () => {
      coolerId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "06:00",
        title: "Fridge check",
        target: { id: org.targets.fridge.id, name: "Walk-in Cooler" },
      });
      await insertRecord(coolerId, {
        recordedAt: yesterdayAt("05:50"),
        temperature: { recordedC: "3.0", result: "ok" },
      });

      freezerId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "07:00",
        title: "Freezer 100% audit",
        target: { id: org.targets.fridge.id, name: "Back_room freezer" },
      });

      floorId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "08:00",
        title: "Floor cleaning",
        target: null,
      });
      await insertRecord(floorId, { recordedAt: yesterdayAt("07:50") });

      handWashId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "09:00",
        title: "Hand wash",
        target: null,
      });
    });

    async function search(
      term: string,
      query: Record<string, string> = {},
    ): Promise<(string | null)[]> {
      const page = await listRecords({ search: term, ...query });
      expect(page.total, `total for "${term}"`).toBe(page.items.length);
      return page.items.map((item) => item.occurrenceId);
    }

    it("matches the check name on both branches, case-insensitively", async () => {
      expect(await search("FRIDGE")).toEqual([coolerId]);
      expect(await search("floor")).toEqual([floorId]);
      expect(await search("hAnD")).toEqual([handWashId]);
      expect(await search("audit")).toEqual([freezerId]);
    });

    it("matches the item name on both branches", async () => {
      expect(await search("cooler")).toEqual([coolerId]);
      expect(await search("back_room")).toEqual([freezerId]);
    });

    it("lists a row once when both its names match", async () => {
      expect(await search("freezer")).toEqual([freezerId]);
    });

    it("treats % and _ as literal characters, not wildcards", async () => {
      expect(await search("%")).toEqual([freezerId]);
      expect(await search("_")).toEqual([freezerId]);
      expect(await search("100%")).toEqual([freezerId]);
      expect(await search("k_r")).toEqual([freezerId]);
      expect(await search("c_")).toEqual([]);
      expect(await search("\\")).toEqual([]);
    });

    it("pages and counts under the same predicate", async () => {
      expect(await search("A")).toHaveLength(4);
      const page = await listRecords({
        search: "a",
        page: "2",
        pageSize: "25",
      });
      expect(page.items).toEqual([]);
      expect(page.total).toBe(4);
    });

    it("ANDs with the other filters and ignores a blank term", async () => {
      expect(await search("fr", { state: "missed" })).toEqual([freezerId]);
      expect(await search("fr", { outcome: "passed" })).toEqual([coolerId]);
      expect(await search("   ")).toEqual([
        coolerId,
        freezerId,
        floorId,
        handWashId,
      ]);
    });
  });

  describe("filter options", () => {
    const path = () => `/locations/${org.locations.main.id}/records/filters`;

    it("offers the checks used here, every item and everyone who recorded here", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });
      await insertRecord(occurrenceId, {
        recordedAt: wallClockToInstant(daysAgo(1), "07:50", org.timeZone),
        temperature: { recordedC: "3.0", result: "ok" },
      });

      const response = await apiRequest(path(), { actor: asAdmin(org) });
      expect(response.status).toBe(200);
      const body = recordsFilterOptionsResponseSchema.parse(
        await response.json(),
      );

      expect(body.forms).toEqual([
        {
          id: org.forms.fridgeCheck.id,
          name: expect.any(String),
          archived: false,
        },
      ]);
      expect(body.targets.map((target) => target.id)).toContain(
        org.targets.fridge.id,
      );
      expect(body.people).toEqual([
        expect.objectContaining({ id: org.employee.userId }),
      ]);
    });

    it("labels a component like its snapshot and lists archived items", async () => {
      const [area] = await db
        .insert(targets)
        .values({
          locationId: org.locations.main.id,
          kind: "area",
          name: "Cold room",
        })
        .returning();
      await db.insert(targets).values({
        locationId: org.locations.main.id,
        kind: "component",
        name: "Walls",
        parentId: area!.id,
      });
      await db.insert(targets).values({
        locationId: org.locations.main.id,
        kind: "equipment",
        name: "Old freezer",
        archivedAt: new Date(),
      });

      const body = recordsFilterOptionsResponseSchema.parse(
        await (await apiRequest(path(), { actor: asAdmin(org) })).json(),
      );

      expect(body.targets).toContainEqual(
        expect.objectContaining({ name: "Cold room › Walls", archived: false }),
      );
      expect(body.targets).toContainEqual(
        expect.objectContaining({ name: "Old freezer", archived: true }),
      );
    });

    it("keeps an archived check and item that old rows still point at", async () => {
      await insertOccurrence({ type: "temperature" });
      await db
        .update(forms)
        .set({ archivedAt: new Date() })
        .where(eq(forms.id, org.forms.fridgeCheck.id));
      await db
        .update(targets)
        .set({ archivedAt: new Date() })
        .where(eq(targets.id, org.targets.fridge.id));

      const body = recordsFilterOptionsResponseSchema.parse(
        await (await apiRequest(path(), { actor: asAdmin(org) })).json(),
      );

      expect(body.forms).toEqual([
        expect.objectContaining({
          id: org.forms.fridgeCheck.id,
          archived: true,
        }),
      ]);
      expect(body.targets).toContainEqual(
        expect.objectContaining({ id: org.targets.fridge.id, archived: true }),
      );
    });

    it("never offers another location's rows or another tenant's data", async () => {
      const occurrenceId = await insertOccurrence({ type: "temperature" });
      await insertRecord(occurrenceId, {
        recordedAt: wallClockToInstant(daysAgo(1), "07:50", org.timeZone),
        temperature: { recordedC: "3.0", result: "ok" },
      });

      const annex = recordsFilterOptionsResponseSchema.parse(
        await (
          await apiRequest(
            `/locations/${org.locations.annex.id}/records/filters`,
            { actor: asAdmin(org) },
          )
        ).json(),
      );
      expect(annex.forms).toEqual([]);
      expect(annex.people).toEqual([]);
      expect(annex.targets.map((target) => target.id)).not.toContain(
        org.targets.fridge.id,
      );

      const other = await seedOrganization(db, { slug: "records-options" });
      expect(
        (
          await apiRequest(path(), {
            actor: asAdmin(other),
          })
        ).status,
      ).toBe(403);
    });

    it("is admin-only", async () => {
      expect(
        (await apiRequest(path(), { actor: asEmployee(org) })).status,
      ).toBe(403);
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

      const filtered = await listRecords({ category: "temperature" });
      expect(filtered.total).toBe(1);
    });

    it("returns a zero total and an empty page for a range with no eligible work", async () => {
      const page = await listRecords({
        dateFrom: "2019-01-01",
        dateTo: "2019-01-31",
      });

      expect(page).toEqual({ items: [], total: 0, formVersions: {} });
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

      expect(find(springPage, springId).entryDate).toBe(spring);
      expect(find(springPage, springId).entryTime).toBe("03:30");
      expect(find(autumnPage, autumnId).entryDate).toBe(autumn);
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
      // Both union branches, their two counts and one batched form-version lookup; none per row.
      expect(oneRowSelects).toBeLessThanOrEqual(5);
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
      ["a search over 100 characters", () => ({ search: "x".repeat(101) })],
      ["an unknown outcome value", () => ({ outcome: "late" })],
      ["an unknown parameter", () => ({ limit: "10" })],
      ["an unlisted sort field", () => ({ sortBy: "status" })],
      ["an invalid sort direction", () => ({ sortOrder: "sideways" })],
      ["an unknown category value", () => ({ category: "delivery" })],
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
  /**
   * HACCP-17: the same canonical dataset read whole, from one snapshot, for browser
   * printing — paging and interactive sort are not accepted here.
   */
  describe("report", () => {
    function reportPath(
      query: Record<string, string> = {},
      locationId = org.locations.main.id,
    ): string {
      const params = new URLSearchParams({
        dateFrom: daysAgo(6),
        dateTo: today(),
        ...query,
      });

      return `/locations/${locationId}/records/report?${params.toString()}`;
    }

    async function getReport(
      query: Record<string, string> = {},
    ): Promise<RecordsReportResponse> {
      const response = await apiRequest(reportPath(query), {
        actor: asAdmin(org),
      });

      expect(response.status).toBe(200);
      return recordsReportResponseSchema.parse(await response.json());
    }

    async function getCompleteReport(
      query: Record<string, string> = {},
    ): Promise<RecordsReportOk> {
      const report = await getReport(query);
      expect(report.status).toBe("ok");
      return report as RecordsReportOk;
    }

    it("returns a valid zero-record report for a range with nothing eligible", async () => {
      const report = await getCompleteReport();

      expect(report).toMatchObject({ total: 0, items: [] });
      expect(Date.parse(report.generatedAt)).not.toBeNaN();
    });

    it("includes submitted, missed, voided and opened no-deadline rows", async () => {
      const submittedId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "07:00",
      });
      await insertRecord(submittedId, {
        recordedAt: wallClockToInstant(daysAgo(1), "06:50", org.timeZone),
      });

      const missedId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "09:00",
      });

      const voidedId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "10:00",
      });
      await insertRecord(voidedId, {
        recordedAt: wallClockToInstant(daysAgo(1), "09:55", org.timeZone),
        voidedAt: new Date(),
        voidedByUserId: org.admin.userId,
      });

      const openId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "11:00",
        dueAt: null,
      });

      const report = await getCompleteReport();
      const byId = new Map(
        report.items.map((item) => [item.occurrenceId, item]),
      );

      expect(byId.get(submittedId)?.displayState).toBe("submitted");
      expect(byId.get(missedId)?.displayState).toBe("missed");
      expect(byId.get(voidedId)?.displayState).toBe("voided");
      expect(byId.get(openId)?.displayState).toBe("open");
      expect(report.total).toBe(4);
    });

    it("excludes finite-deadline work that is not yet due", async () => {
      await insertOccurrence({
        type: "cleaning",
        occurrenceDate: today(),
        scheduledTime: "23:59",
        dueAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      await expect(getCompleteReport()).resolves.toMatchObject({ total: 0 });
    });

    it("excludes no-deadline work that has not opened yet", async () => {
      await insertOccurrence({
        type: "cleaning",
        occurrenceDate: today(),
        availableAt: new Date(Date.now() + 60 * 60 * 1000),
        dueAt: null,
      });

      await expect(getCompleteReport()).resolves.toMatchObject({ total: 0 });
    });

    it("includes no-deadline work from the moment it opens", async () => {
      const openedId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: today(),
        availableAt: new Date(Date.now() - 1000),
        dueAt: null,
      });

      const report = await getCompleteReport();

      expect(report.items.map((item) => item.occurrenceId)).toEqual([openedId]);
      expect(report.items[0]).toMatchObject({
        displayState: "open",
        dueAt: null,
      });
    });

    it("includes a submission made before a finite deadline", async () => {
      const earlyId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: today(),
        scheduledTime: "23:59",
        dueAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      await insertRecord(earlyId, { recordedAt: new Date() });

      const report = await getCompleteReport();

      expect(report.items.map((item) => item.occurrenceId)).toEqual([earlyId]);
      expect(report.items[0]!.displayState).toBe("submitted");
    });

    it("reports a submitted no-deadline record as having no deadline", async () => {
      const openId = await insertOccurrence({
        type: "cleaning",
        occurrenceDate: today(),
        availableAt: new Date(Date.now() - 1000),
        dueAt: null,
      });
      await insertRecord(openId, { recordedAt: new Date() });

      const report = await getCompleteReport();

      expect(report.items[0]).toMatchObject({
        displayState: "submitted",
        timing: "no_deadline",
        dueAt: null,
      });
    });

    it("matches the grid total for identical filters", async () => {
      for (const scheduledTime of ["07:00", "08:00", "09:00"]) {
        await insertOccurrence({ type: "cleaning", scheduledTime });
      }
      const submittedId = await insertOccurrence({
        type: "temperature",
        scheduledTime: "10:00",
      });
      await insertRecord(submittedId, {
        recordedAt: wallClockToInstant(daysAgo(1), "09:50", org.timeZone),
        temperature: { recordedC: "3.0", result: "ok" },
      });

      const filterSets: Record<string, string>[] = [
        {},
        { state: "missed" },
        { category: "temperature" },
        { state: "missed,submitted" },
      ];

      for (const filters of filterSets) {
        const [grid, report] = await Promise.all([
          listRecords({ ...filters, page: "1", pageSize: "100" }),
          getCompleteReport(filters),
        ]);

        expect(report.total).toBe(grid.total);
        expect(report.items).toHaveLength(grid.total);
      }
    });

    it("returns the complete dataset in canonical chronological order", async () => {
      const ids: string[] = [];
      for (const day of [3, 1, 2]) {
        for (const scheduledTime of ["09:00", "07:00"]) {
          ids.push(
            await insertOccurrence({
              type: "cleaning",
              occurrenceDate: daysAgo(day),
              scheduledTime,
            }),
          );
        }
      }

      const report = await getCompleteReport();
      const keys = report.items.map(
        (item) => `${item.entryDate} ${item.entryTime}`,
      );

      expect(report.total).toBe(ids.length);
      expect(keys).toEqual([...keys].sort());
      expect(new Set(report.items.map((item) => item.occurrenceId)).size).toBe(
        ids.length,
      );
    });

    it("breaks ties on occurrence id so the order is deterministic", async () => {
      // The template/date/time triple is unique, so a genuine tie needs two templates.
      const tied = [
        await insertOccurrence({
          type: "cleaning",
          occurrenceDate: daysAgo(2),
          scheduledTime: "08:00",
        }),
        await insertOccurrence({
          type: "temperature",
          occurrenceDate: daysAgo(2),
          scheduledTime: "08:00",
        }),
      ];

      const first = await getCompleteReport();
      const second = await getCompleteReport();
      const order = first.items.map((item) => item.occurrenceId);

      expect(order).toEqual(second.items.map((item) => item.occurrenceId));
      expect(order).toEqual([...tied].sort());
    });

    it("covers a multi-month range with no date-span limit", async () => {
      for (const day of [70, 45, 20, 1]) {
        await insertOccurrence({
          type: "cleaning",
          occurrenceDate: daysAgo(day),
          scheduledTime: "08:00",
        });
      }

      await expect(
        getCompleteReport({ dateFrom: daysAgo(90), dateTo: today() }),
      ).resolves.toMatchObject({ total: 4 });
    });

    it("reads the count and the rows from one repeatable-read transaction", async () => {
      const selects: string[] = [];
      const runTransaction = db.transaction.bind(db);
      const transaction = vi
        .spyOn(db, "transaction")
        .mockImplementation((callback, config) =>
          runTransaction(async (tx) => {
            const select = tx.select.bind(tx);
            vi.spyOn(tx, "select").mockImplementation(((...args: unknown[]) => {
              selects.push("select");
              return (select as (...a: unknown[]) => unknown)(...args);
            }) as typeof tx.select);

            return callback(tx);
          }, config),
        );

      await insertOccurrence({ type: "cleaning", scheduledTime: "08:00" });
      await getCompleteReport();

      expect(transaction.mock.calls[0]![1]).toEqual({
        isolationLevel: "repeatable read",
        accessMode: "read only",
      });
      // Both counts, both row branches and their form versions, all from the same snapshot.
      expect(selects).toHaveLength(5);
    });

    it("stays consistent when a record lands between the count and the read", async () => {
      const occurrenceId = await insertOccurrence({
        type: "cleaning",
        scheduledTime: "08:00",
      });

      const findPage = recordsRepository.findPage.bind(recordsRepository);
      vi.spyOn(recordsRepository, "findPage").mockImplementation(
        async (client, params) => {
          await insertRecord(occurrenceId, { recordedAt: new Date() });
          return findPage(client, params);
        },
      );

      const report = await getCompleteReport({ state: "missed" });

      expect(report.total).toBe(1);
      expect(report.items).toHaveLength(1);
    });

    it.each([
      ["a page", { page: "1", pageSize: "25" }],
      ["a page size", { pageSize: "25" }],
      ["a sort field", { sortBy: "title" }],
      ["a sort direction", { sortOrder: "desc" }],
      ["a search term", { search: "fridge" }],
      ["a pending status", { state: "pending" }],
    ] as [string, Record<string, string>][])(
      "rejects %s",
      async (_label, query) => {
        const response = await apiRequest(reportPath(query), {
          actor: asAdmin(org),
        });

        expect(response.status).toBe(400);
      },
    );

    it("rejects a dateTo after the organization's local today", async () => {
      const response = await apiRequest(
        reportPath({ dateTo: addCalendarDays(today(), 1) }),
        { actor: asAdmin(org) },
      );

      expect(response.status).toBe(400);
    });

    it("denies an employee, an unknown location and another tenant", async () => {
      const employee = await apiRequest(reportPath(), {
        actor: asEmployee(org),
      });
      expect(employee.status).toBe(403);

      const unknown = await apiRequest(
        reportPath({}, "00000000-0000-4000-8000-000000000000"),
        { actor: asAdmin(org) },
      );
      expect(unknown.status).toBe(403);

      const world = await seedTwoTenants(db);
      const otherTenant = await apiRequest(
        `/locations/${world.beta.locations.main.id}/records/report?dateFrom=${zonedDateString(new Date(), world.alpha.timeZone)}&dateTo=${zonedDateString(new Date(), world.alpha.timeZone)}`,
        { actor: asAdmin(world.alpha) },
      );
      expect(otherTenant.status).toBe(403);

      const anonymous = await apiRequest(reportPath());
      expect(anonymous.status).toBe(401);
    });

    it("allows an admin any location in their organization", async () => {
      const response = await apiRequest(
        reportPath({}, org.locations.annex.id),
        { actor: asAdmin(org) },
      );

      expect(response.status).toBe(200);
    });
  });
});
