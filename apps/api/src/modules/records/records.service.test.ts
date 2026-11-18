import {
  RECORDS_PRINT_MAX_ROWS,
  recordsListQuerySchema,
  recordsReportQuerySchema,
  type RecordsListQuery,
  type RecordsReportQuery,
} from "@haccp/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "../../core/db/client.js";
import {
  InternalError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import {
  normalizeRecordsQuery,
  normalizeRecordsReportQuery,
  recordsService,
} from "./records.service.js";
import { formRepository } from "../forms/form.repository.js";
import { recordsRepository, type RecordRow } from "./records.repository.js";

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

beforeEach(() => {
  vi.spyOn(formRepository, "findVersionSummariesByIds").mockResolvedValue([]);
});

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
          category: "temperature",
          state: "voided,submitted",
          result: "fail",
        }),
      ).filters,
    ).toEqual({
      category: ["temperature"],
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
      query({ category: "temperature", state: "submitted" }),
    );

    const filters = { category: ["temperature"], state: ["submitted"] };
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
    ).resolves.toEqual({ items: [], total: 18, formVersions: {} });
  });
});

function reportQuery(
  overrides: Record<string, string> = {},
): RecordsReportQuery {
  return recordsReportQuerySchema.parse({
    dateFrom: "2026-08-17",
    dateTo: "2026-08-23",
    ...overrides,
  });
}

function row(occurrenceId: string): RecordRow {
  return {
    occurrenceId,
    taskTemplateId: "33333333-3333-4333-8333-333333333333",
    occurrenceDate: "2026-08-23",
    scheduledTime: "08:00",
    availableAt: new Date("2026-08-23T00:00:00.000Z"),
    dueAt: new Date("2026-08-23T05:00:00.000Z"),
    title: "Morning fridge check",
    formVersionId: "44444444-4444-4444-8444-444444444444",
    category: "temperature",
    targetId: null,
    targetName: null,
    resolvedLimits: {},
    recordId: null,
    recordCreatedAt: null,
    recordedAt: null,
    voidedAt: null,
    createdById: null,
    createdByFirstName: null,
    createdByLastName: null,
    recordedById: null,
    recordedByFirstName: null,
    recordedByLastName: null,
    voidedById: null,
    voidedByFirstName: null,
    voidedByLastName: null,
    recordResult: null,
    values: null,
    correctiveAction: null,
  };
}

function rows(count: number): RecordRow[] {
  return Array.from({ length: count }, (_, index) =>
    row(`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
  );
}

/** The report path opens a transaction, so the bare `{} as Db` stub is not enough. */
function transactionalDb() {
  const transaction = vi.fn(
    async (
      callback: (tx: unknown) => Promise<unknown>,
      config?: Record<string, string>,
    ) => {
      void config;
      return callback(db);
    },
  );

  return { db: { transaction } as unknown as Db, transaction };
}

function reportAt(instant: string, input: RecordsReportQuery = reportQuery()) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(instant));

  const fake = transactionalDb();

  return {
    ...fake,
    result: recordsService.getRecordsReport(fake.db, {
      locationId: LOCATION_ID,
      organizationId: ORGANIZATION_ID,
      timeZone: TIME_ZONE,
      query: input,
    }),
  };
}

describe("normalizeRecordsReportQuery", () => {
  it("pins the report to the canonical chronological order and the whole dataset", () => {
    expect(normalizeRecordsReportQuery(reportQuery())).toEqual({
      dateFrom: "2026-08-17",
      dateTo: "2026-08-23",
      sortBy: "scheduledAt",
      sortOrder: "asc",
      offset: 0,
      filters: { category: undefined, state: undefined, result: undefined },
    });
  });

  it("carries the optional filters through unchanged", () => {
    expect(
      normalizeRecordsReportQuery(reportQuery({ state: "open,missed" }))
        .filters,
    ).toMatchObject({ state: ["missed", "open"] });
  });
});

describe("getRecordsReport", () => {
  it("reads the count and the rows from one repeatable-read snapshot", async () => {
    const { findPage, countPage } = stubRepository();
    const { result, transaction } = reportAt("2026-08-23T09:00:00.000Z");

    await result;

    expect(transaction.mock.calls[0]![1]).toEqual({
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
    expect(countPage).toHaveBeenCalledTimes(1);
    expect(findPage).toHaveBeenCalledTimes(1);
  });

  it("uses one captured now for the count, the read and generatedAt", async () => {
    const { findPage, countPage } = stubRepository();
    const { result } = reportAt("2026-08-23T09:00:00.000Z");

    await expect(result).resolves.toMatchObject({
      generatedAt: "2026-08-23T09:00:00.000Z",
    });
    expect(findPage.mock.calls[0]![1]!.now).toEqual(
      countPage.mock.calls[0]![1]!.now,
    );
  });

  it("asks for the whole dataset in canonical order", async () => {
    const { findPage } = stubRepository();
    const { result } = reportAt("2026-08-23T09:00:00.000Z");

    await result;

    expect(findPage.mock.calls[0]![1]).toMatchObject({
      sortBy: "scheduledAt",
      sortOrder: "asc",
      offset: 0,
      limit: RECORDS_PRINT_MAX_ROWS + 1,
    });
  });

  it("returns a valid zero-record report", async () => {
    stubRepository();
    const { result } = reportAt("2026-08-23T09:00:00.000Z");

    await expect(result).resolves.toMatchObject({
      status: "ok",
      total: 0,
      items: [],
    });
  });

  it("accepts a result at the row limit", async () => {
    vi.spyOn(recordsRepository, "countPage").mockResolvedValue(
      RECORDS_PRINT_MAX_ROWS,
    );
    vi.spyOn(recordsRepository, "findPage").mockResolvedValue(
      rows(RECORDS_PRINT_MAX_ROWS),
    );

    const { result } = reportAt("2026-08-23T09:00:00.000Z");
    const report = await result;

    expect(report.status).toBe("ok");
    expect(report).toMatchObject({ total: RECORDS_PRINT_MAX_ROWS });
  });

  it("rejects one row past the limit before materializing any rows", async () => {
    const { findPage } = stubRepository();
    vi.spyOn(recordsRepository, "countPage").mockResolvedValue(
      RECORDS_PRINT_MAX_ROWS + 1,
    );

    const { result } = reportAt("2026-08-23T09:00:00.000Z");

    await expect(result).resolves.toEqual({
      status: "too_large",
      generatedAt: "2026-08-23T09:00:00.000Z",
      total: RECORDS_PRINT_MAX_ROWS + 1,
      limit: RECORDS_PRINT_MAX_ROWS,
    });
    expect(findPage).not.toHaveBeenCalled();
  });

  it("fails the whole report when the read does not match the snapshot total", async () => {
    vi.spyOn(recordsRepository, "countPage").mockResolvedValue(3);
    vi.spyOn(recordsRepository, "findPage").mockResolvedValue(rows(2));

    await expect(
      reportAt("2026-08-23T09:00:00.000Z").result,
    ).rejects.toBeInstanceOf(InternalError);
  });

  it("fails the whole report when an occurrence appears twice", async () => {
    const duplicate = row("44444444-4444-4444-8444-444444444444");
    vi.spyOn(recordsRepository, "countPage").mockResolvedValue(2);
    vi.spyOn(recordsRepository, "findPage").mockResolvedValue([
      duplicate,
      duplicate,
    ]);

    await expect(
      reportAt("2026-08-23T09:00:00.000Z").result,
    ).rejects.toBeInstanceOf(InternalError);
  });

  it("rejects a range ending after the organization's current date", async () => {
    stubRepository();

    await expect(
      reportAt(
        "2026-08-22T21:30:00.000Z",
        reportQuery({ dateTo: "2026-08-23" }),
      ).result,
    ).resolves.toMatchObject({ status: "ok" });

    await expect(
      reportAt(
        "2026-08-22T20:30:00.000Z",
        reportQuery({ dateTo: "2026-08-23" }),
      ).result,
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("imposes no date-span limit on a retained historical range", async () => {
    stubRepository();

    await expect(
      reportAt(
        "2026-08-23T09:00:00.000Z",
        reportQuery({ dateFrom: "2025-08-23", dateTo: "2026-08-23" }),
      ).result,
    ).resolves.toMatchObject({ status: "ok" });
  });
});
