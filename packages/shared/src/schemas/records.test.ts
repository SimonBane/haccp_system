import { describe, expect, it } from "vitest";
import { addCalendarDays } from "../lib/calendar-date.js";
import {
  defaultRecordsDateRange,
  deriveRecordDisplayState,
  deriveRecordEntryState,
  deriveRecordResult,
  deriveRecordTiming,
  isRecordEligible,
  RECORDS_DEFAULT_RANGE_DAYS,
  RECORDS_DEFAULT_SORT,
  RECORDS_RESULT_FILTER_VALUES,
  RECORDS_SORT_FIELDS,
  RECORDS_STATE_FILTER_VALUES,
  RECORDS_TYPE_FILTER_VALUES,
  recordItemSchema,
  recordsListQuerySchema,
  recordsListResponseSchema,
  validateRecordsDateRange,
} from "./records.js";

const DATE_FROM = "2026-08-17";
const DATE_TO = "2026-08-23";
const TODAY = "2026-08-23";

const OCCURRENCE_ID = "11111111-1111-4111-8111-111111111111";
const TEMPLATE_ID = "22222222-2222-4222-8222-222222222222";
const EQUIPMENT_ID = "33333333-3333-4333-8333-333333333333";
const RECORD_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "55555555-5555-4555-8555-555555555555";

function parse(query: Record<string, string>) {
  return recordsListQuerySchema.safeParse({
    dateFrom: DATE_FROM,
    dateTo: DATE_TO,
    ...query,
  });
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    occurrenceId: OCCURRENCE_ID,
    taskTemplateId: TEMPLATE_ID,
    occurrenceDate: DATE_TO,
    scheduledTime: "08:00",
    dueAt: "2026-08-23T05:00:00.000Z",
    title: "Morning fridge check",
    type: "temperature",
    equipmentId: EQUIPMENT_ID,
    equipmentName: "Fridge 1",
    minTempC: 0,
    maxTempC: 5,
    displayState: "submitted",
    recordState: "submitted",
    timing: "on_time",
    result: "pass",
    record: {
      recordId: RECORD_ID,
      createdAt: "2026-08-23T04:50:00.000Z",
      createdBy: { id: USER_ID, firstName: "Ada", lastName: "Admin" },
      recordedAt: "2026-08-23T04:55:00.000Z",
      recordedBy: { id: USER_ID, firstName: "Ada", lastName: "Admin" },
      voidedAt: null,
      voidedBy: null,
      temperature: {
        recordedC: 3.5,
        minTempC: 0,
        maxTempC: 5,
        result: "ok",
        correctiveAction: null,
      },
    },
    ...overrides,
  };
}

describe("records constants", () => {
  it("pins the sort allowlist, filter values and default range", () => {
    expect(RECORDS_SORT_FIELDS).toEqual(["scheduledAt", "title"]);
    expect(RECORDS_DEFAULT_SORT).toEqual({
      sortBy: "scheduledAt",
      sortOrder: "asc",
    });
    expect(RECORDS_TYPE_FILTER_VALUES).toEqual([
      "temperature",
      "cleaning",
    ]);
    expect(RECORDS_STATE_FILTER_VALUES).toEqual([
      "submitted",
      "missed",
      "voided",
    ]);
    expect(RECORDS_RESULT_FILTER_VALUES).toEqual([
      "pass",
      "fail",
      "not_evaluated",
    ]);
    expect(RECORDS_DEFAULT_RANGE_DAYS).toBe(7);
  });

  it("has no pending state to filter by — upcoming work is not a record", () => {
    expect(RECORDS_STATE_FILTER_VALUES).not.toContain("pending");
    expect(parse({ state: "pending" }).success).toBe(false);
  });
});

describe("recordsListQuerySchema date range", () => {
  it("requires both dates", () => {
    expect(recordsListQuerySchema.safeParse({}).success).toBe(false);
    expect(
      recordsListQuerySchema.safeParse({ dateFrom: DATE_FROM }).success,
    ).toBe(false);
    expect(recordsListQuerySchema.safeParse({ dateTo: DATE_TO }).success).toBe(
      false,
    );
  });

  it("rejects dateFrom after dateTo", () => {
    expect(
      recordsListQuerySchema.safeParse({
        dateFrom: "2026-08-24",
        dateTo: "2026-08-23",
      }).success,
    ).toBe(false);
  });

  it("accepts a single-day range", () => {
    expect(
      recordsListQuerySchema.safeParse({
        dateFrom: DATE_TO,
        dateTo: DATE_TO,
      }).success,
    ).toBe(true);
  });

  it.each(["2026-8-17", "17-08-2026", "2026-08-17T00:00:00Z", "2026-02-30"])(
    "rejects %o as a calendar date",
    (dateFrom) => {
      expect(
        recordsListQuerySchema.safeParse({ dateFrom, dateTo: DATE_TO }).success,
      ).toBe(false);
    },
  );

  it.each([60, 90, 365, 400])(
    "imposes no maximum span — %i days is a valid historical range",
    (days) => {
      expect(
        recordsListQuerySchema.safeParse({
          dateFrom: addCalendarDays(DATE_TO, -days),
          dateTo: DATE_TO,
        }).success,
      ).toBe(true);
    },
  );
});

describe("recordsListQuerySchema grid fields", () => {
  it("leaves paging and sorting for the service to normalize", () => {
    expect(parse({}).data).toMatchObject({
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
      sortOrder: "asc",
    });
    expect(parse({}).data?.page).toBeUndefined();
    expect(parse({}).data?.pageSize).toBeUndefined();
  });

  it("requires page and pageSize together", () => {
    expect(parse({ page: "2" }).success).toBe(false);
    expect(parse({ pageSize: "25" }).success).toBe(false);
    expect(parse({ page: "2", pageSize: "25" }).success).toBe(true);
  });

  it("caps the page size at 100", () => {
    expect(parse({ page: "1", pageSize: "100" }).success).toBe(true);
    expect(parse({ page: "1", pageSize: "101" }).success).toBe(false);
  });

  it("accepts only the allowlisted sort fields and directions", () => {
    for (const sortBy of RECORDS_SORT_FIELDS) {
      expect(parse({ sortBy, sortOrder: "asc" }).success).toBe(true);
      expect(parse({ sortBy, sortOrder: "desc" }).success).toBe(true);
    }

    expect(parse({ sortBy: "status" }).success).toBe(false);
    expect(parse({ sortBy: "title; drop table" }).success).toBe(false);
    expect(parse({ sortBy: "title", sortOrder: "sideways" }).success).toBe(
      false,
    );
  });

  it("rejects search and any unknown parameter", () => {
    expect(parse({ search: "fridge" }).success).toBe(false);
    expect(parse({ q: "fridge" }).success).toBe(false);
    expect(parse({ locationId: OCCURRENCE_ID }).success).toBe(false);
  });
});

describe("recordsListQuerySchema filters", () => {
  it("parses comma-separated values, trimming, deduplicating and sorting", () => {
    expect(
      parse({ state: " voided , submitted ,submitted" }).data?.state,
    ).toEqual(["submitted", "voided"]);
  });

  it("treats an omitted or empty filter as absent", () => {
    expect(parse({}).data?.type).toBeUndefined();
    expect(parse({ type: "" }).data?.type).toBeUndefined();
    expect(parse({ type: " , " }).data?.type).toBeUndefined();
  });

  it("rejects a value outside the allowlist", () => {
    expect(parse({ type: "temperature,delivery" }).success).toBe(false);
    expect(parse({ result: "unknown" }).success).toBe(false);
    expect(parse({ state: "Submitted" }).success).toBe(false);
  });

  it("accepts voided combined with fail", () => {
    expect(parse({ state: "voided", result: "fail" }).data).toMatchObject({
      state: ["voided"],
      result: ["fail"],
    });
  });
});

describe("validateRecordsDateRange", () => {
  it("accepts a historical range ending today", () => {
    expect(
      validateRecordsDateRange({
        dateFrom: DATE_FROM,
        dateTo: DATE_TO,
        today: TODAY,
      }),
    ).toBeNull();
  });

  it("rejects a dateTo after organization-local today", () => {
    expect(
      validateRecordsDateRange({
        dateFrom: TODAY,
        dateTo: addCalendarDays(TODAY, 1),
        today: TODAY,
      }),
    ).toBe("future");
  });

  it("rejects a reversed range", () => {
    expect(
      validateRecordsDateRange({
        dateFrom: DATE_TO,
        dateTo: DATE_FROM,
        today: TODAY,
      }),
    ).toBe("order");
  });

  it("rejects malformed and non-existent dates", () => {
    expect(
      validateRecordsDateRange({
        dateFrom: "2026-8-1",
        dateTo: DATE_TO,
        today: TODAY,
      }),
    ).toBe("invalid");
    expect(
      validateRecordsDateRange({
        dateFrom: "2026-02-30",
        dateTo: DATE_TO,
        today: TODAY,
      }),
    ).toBe("invalid");
  });

  it.each([60, 90, 365])("accepts a %i-day historical span", (days) => {
    expect(
      validateRecordsDateRange({
        dateFrom: addCalendarDays(TODAY, -days),
        dateTo: TODAY,
        today: TODAY,
      }),
    ).toBeNull();
  });

  it("accepts a range that predates any data", () => {
    expect(
      validateRecordsDateRange({
        dateFrom: "2019-01-01",
        dateTo: "2019-01-31",
        today: TODAY,
      }),
    ).toBeNull();
  });
});

describe("defaultRecordsDateRange", () => {
  it("covers the last seven inclusive calendar dates", () => {
    expect(defaultRecordsDateRange(TODAY)).toEqual({
      dateFrom: "2026-08-17",
      dateTo: "2026-08-23",
    });
  });

  it("crosses month, year and leap-day boundaries", () => {
    expect(defaultRecordsDateRange("2026-03-03")).toEqual({
      dateFrom: "2026-02-25",
      dateTo: "2026-03-03",
    });
    expect(defaultRecordsDateRange("2026-01-03")).toEqual({
      dateFrom: "2025-12-28",
      dateTo: "2026-01-03",
    });
    expect(defaultRecordsDateRange("2028-03-02")).toEqual({
      dateFrom: "2028-02-25",
      dateTo: "2028-03-02",
    });
  });
});

describe("recordsListResponseSchema", () => {
  // Generic page-shape rules (total bounds, tolerance for unknown fields, ...)
  // are covered once by createGridPageSchema's own tests in grid.test.ts.
  it("parses a page of record items", () => {
    const parsed = recordsListResponseSchema.parse({
      items: [item()],
      total: 18,
    });

    expect(parsed.total).toBe(18);
    expect(parsed.items).toHaveLength(1);
  });
});

describe("recordItemSchema", () => {
  it("accepts a missed row with no record", () => {
    expect(
      recordItemSchema.parse(
        item({
          displayState: "missed",
          recordState: "none",
          timing: "not_submitted",
          result: "not_evaluated",
          record: null,
        }),
      ).record,
    ).toBeNull();
  });

  it("accepts a non-temperature row with no equipment or range", () => {
    expect(
      recordItemSchema.safeParse(
        item({
          type: "cleaning",
          equipmentId: null,
          equipmentName: null,
          minTempC: null,
          maxTempC: null,
          result: "not_evaluated",
          record: null,
          displayState: "missed",
          recordState: "none",
          timing: "not_submitted",
        }),
      ).success,
    ).toBe(true);
  });

  it("rejects a pending display state", () => {
    expect(
      recordItemSchema.safeParse(item({ displayState: "pending" })).success,
    ).toBe(false);
  });

  it("has no last-edit or void-reason metadata M0 does not store", () => {
    const parsed = recordItemSchema.parse(item());

    expect(parsed.record).not.toHaveProperty("lastEditedAt");
    expect(parsed.record).not.toHaveProperty("lastEditedBy");
    expect(parsed.record).not.toHaveProperty("voidReason");
  });
});

describe("record eligibility", () => {
  const dueAt = new Date("2026-08-23T05:00:00.000Z");
  const before = new Date("2026-08-23T04:00:00.000Z");
  const after = new Date("2026-08-23T06:00:00.000Z");

  it("includes a submitted record immediately, even before its due time", () => {
    expect(isRecordEligible({ hasRecord: true, dueAt, now: before })).toBe(
      true,
    );
  });

  it("includes a retained voided record immediately", () => {
    expect(isRecordEligible({ hasRecord: true, dueAt, now: before })).toBe(
      true,
    );
  });

  it("includes an unrecorded occurrence only once it is due", () => {
    expect(isRecordEligible({ hasRecord: false, dueAt, now: before })).toBe(
      false,
    );
    expect(isRecordEligible({ hasRecord: false, dueAt, now: dueAt })).toBe(
      true,
    );
    expect(isRecordEligible({ hasRecord: false, dueAt, now: after })).toBe(
      true,
    );
  });
});

describe("state derivation", () => {
  const dueAt = new Date("2026-08-23T05:00:00.000Z");

  it("derives submitted for an active record", () => {
    const record = { recordedAt: dueAt, voidedAt: null };
    expect(deriveRecordDisplayState(record)).toBe("submitted");
    expect(deriveRecordEntryState(record)).toBe("submitted");
  });

  it("derives voided for a retained voided record", () => {
    const record = {
      recordedAt: dueAt,
      voidedAt: new Date("2026-08-23T07:00:00.000Z"),
    };
    expect(deriveRecordDisplayState(record)).toBe("voided");
    expect(deriveRecordEntryState(record)).toBe("voided");
  });

  it("derives missed when there is no record", () => {
    expect(deriveRecordDisplayState(null)).toBe("missed");
    expect(deriveRecordEntryState(null)).toBe("none");
  });
});

describe("timing derivation", () => {
  const dueAt = new Date("2026-08-23T05:00:00.000Z");

  it("is on_time when the record lands at or before the due instant", () => {
    expect(
      deriveRecordTiming({
        record: {
          recordedAt: new Date("2026-08-23T04:00:00.000Z"),
          voidedAt: null,
        },
        dueAt,
      }),
    ).toBe("on_time");
    expect(
      deriveRecordTiming({
        record: { recordedAt: dueAt, voidedAt: null },
        dueAt,
      }),
    ).toBe("on_time");
  });

  it("is late one millisecond past the due instant", () => {
    expect(
      deriveRecordTiming({
        record: {
          recordedAt: new Date(dueAt.getTime() + 1),
          voidedAt: null,
        },
        dueAt,
      }),
    ).toBe("late");
  });

  it("is not_submitted without an active submission", () => {
    expect(deriveRecordTiming({ record: null, dueAt })).toBe("not_submitted");
    expect(
      deriveRecordTiming({
        record: { recordedAt: dueAt, voidedAt: new Date() },
        dueAt,
      }),
    ).toBe("not_submitted");
  });
});

describe("result derivation", () => {
  it("maps the stored temperature payload, including on a voided record", () => {
    expect(deriveRecordResult({ result: "ok" })).toBe("pass");
    expect(deriveRecordResult({ result: "out_of_range" })).toBe("fail");
  });

  it("is not_evaluated without a temperature detail", () => {
    expect(deriveRecordResult(null)).toBe("not_evaluated");
  });
});
