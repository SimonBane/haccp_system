import { recordsListQuerySchema, type RecordsListQuery } from "@haccp/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../../core/db/client.js";
import {
  InternalError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { normalizeRecordsQuery, recordsService } from "./records.service.js";
import { recordsRepository } from "./records.repository.js";

const LOCATION_ID = "11111111-1111-4111-8111-111111111111";
const ORGANIZATION_ID = "22222222-2222-4222-8222-222222222222";
const TIME_ZONE = "Europe/Sofia";
const db = {} as Db;

function query(overrides: Record<string, string> = {}): RecordsListQuery {
  return recordsListQuerySchema.parse({
    dateFrom: "2026-08-17",
    dateTo: "2026-08-23",
    ...overrides,
  });
}

function stubRepository() {
  const findPage = vi
    .spyOn(recordsRepository, "findPage")
    .mockResolvedValue([]);
  const countPage = vi
    .spyOn(recordsRepository, "countPage")
    .mockResolvedValue(0);

  return { findPage, countPage };
}

function listAt(instant: string, input: RecordsListQuery = query()) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(instant));

  return recordsService.listRecords(db, {
    locationId: LOCATION_ID,
    organizationId: ORGANIZATION_ID,
    timeZone: TIME_ZONE,
    query: input,
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("normalizeRecordsQuery", () => {
  it("defaults omitted paging to page 1 and page size 25", () => {
    expect(normalizeRecordsQuery(query())).toMatchObject({
      page: 1,
      pageSize: 25,
    });
  });

  it("defaults omitted sorting to scheduledAt ascending", () => {
    expect(normalizeRecordsQuery(query())).toMatchObject({
      sortBy: "scheduledAt",
      sortOrder: "asc",
    });
  });

  it("keeps an explicit page, size and sort", () => {
    expect(
      normalizeRecordsQuery(
        query({
          page: "3",
          pageSize: "100",
          sortBy: "title",
          sortOrder: "desc",
        }),
      ),
    ).toMatchObject({
      page: 3,
      pageSize: 100,
      sortBy: "title",
      sortOrder: "desc",
    });
  });

  it("carries the parsed filters through unchanged", () => {
    expect(
      normalizeRecordsQuery(
        query({
          type: "temperature",
          state: "voided,submitted",
          result: "fail",
        }),
      ).filters,
    ).toEqual({
      type: ["temperature"],
      state: ["submitted", "voided"],
      result: ["fail"],
    });
  });
});

describe("date-range validation", () => {
  it("accepts a range ending on the organization's local today", () => {
    stubRepository();
    // 22:30 UTC is already the 24th in Sofia (UTC+3 in August).
    return expect(
      listAt("2026-08-23T22:30:00.000Z", query({ dateTo: "2026-08-24" })),
    ).resolves.toBeDefined();
  });

  it("rejects a dateTo that is still tomorrow in the organization's zone", async () => {
    stubRepository();

    await expect(
      listAt("2026-08-23T09:00:00.000Z", query({ dateTo: "2026-08-24" })),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("never reaches the database for a rejected range", async () => {
    const { findPage, countPage } = stubRepository();

    await expect(
      listAt("2026-08-23T09:00:00.000Z", query({ dateTo: "2026-08-24" })),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(findPage).not.toHaveBeenCalled();
    expect(countPage).not.toHaveBeenCalled();
  });

  it("accepts a multi-month historical span", async () => {
    stubRepository();

    await expect(
      listAt(
        "2026-08-23T09:00:00.000Z",
        query({ dateFrom: "2026-05-01", dateTo: "2026-08-23" }),
      ),
    ).resolves.toMatchObject({ items: [], total: 0 });
  });

  it("fails loudly on an unusable organization timezone", async () => {
    stubRepository();

    await expect(
      recordsService.listRecords(db, {
        locationId: LOCATION_ID,
        organizationId: ORGANIZATION_ID,
        timeZone: "Mars/Olympus",
        query: query(),
      }),
    ).rejects.toBeInstanceOf(InternalError);
  });
});

describe("repository dispatch", () => {
  it("converts a one-based page into a limit and offset", async () => {
    const { findPage } = stubRepository();

    await listAt(
      "2026-08-23T09:00:00.000Z",
      query({ page: "3", pageSize: "25" }),
    );

    expect(findPage.mock.calls[0]![1]).toMatchObject({
      limit: 25,
      offset: 50,
    });
  });

  it("asks for offset zero on page one", async () => {
    const { findPage } = stubRepository();

    await listAt("2026-08-23T09:00:00.000Z");

    expect(findPage.mock.calls[0]![1]).toMatchObject({ limit: 25, offset: 0 });
  });

  it("gives the page and the count the same captured now", async () => {
    const { findPage, countPage } = stubRepository();

    await listAt("2026-08-23T09:00:00.000Z");

    expect(findPage.mock.calls[0]![1]!.now).toEqual(
      countPage.mock.calls[0]![1]!.now,
    );
    expect(findPage.mock.calls[0]![1]!.now.toISOString()).toBe(
      "2026-08-23T09:00:00.000Z",
    );
  });

  it("scopes the page query and the count to the location and its organization", async () => {
    const { findPage, countPage } = stubRepository();

    await listAt("2026-08-23T09:00:00.000Z");

    for (const call of [findPage.mock.calls[0]!, countPage.mock.calls[0]!]) {
      expect(call[1]).toMatchObject({
        locationId: LOCATION_ID,
        organizationId: ORGANIZATION_ID,
        dateFrom: "2026-08-17",
        dateTo: "2026-08-23",
      });
    }
  });

  it("applies the same optional filters to the page and the count", async () => {
    const { findPage, countPage } = stubRepository();

    await listAt(
      "2026-08-23T09:00:00.000Z",
      query({ type: "temperature", state: "submitted" }),
    );

    const filters = { type: ["temperature"], state: ["submitted"] };
    expect(findPage.mock.calls[0]![1]!.filters).toMatchObject(filters);
    expect(countPage.mock.calls[0]![1]!.filters).toMatchObject(filters);
  });

  it("reads the total from the counting query", async () => {
    vi.spyOn(recordsRepository, "findPage").mockResolvedValue([]);
    vi.spyOn(recordsRepository, "countPage").mockResolvedValue(18);

    await expect(listAt("2026-08-23T09:00:00.000Z")).resolves.toMatchObject({
      total: 18,
    });
  });

  it("returns an empty page beyond the last one without changing the total", async () => {
    vi.spyOn(recordsRepository, "findPage").mockResolvedValue([]);
    vi.spyOn(recordsRepository, "countPage").mockResolvedValue(18);

    await expect(
      listAt("2026-08-23T09:00:00.000Z", query({ page: "9", pageSize: "25" })),
    ).resolves.toEqual({ items: [], total: 18 });
  });
});
