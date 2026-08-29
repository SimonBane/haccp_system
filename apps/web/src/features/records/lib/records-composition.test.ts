import { GRID_DEFAULT_PAGE_SIZE } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { buildGridRequest } from "@/components/ui/data-table/server-grid/grid-request";
import { queryKeys } from "@/lib/api/query-keys";
import { EM_DASH, hasTemperatureOutcome, recordReading } from "./format";
import {
  buildRecordsFilterDefinitions,
  isTemperatureResultFilterVisible,
  RECORDS_FILTER_KEY,
  shouldClearResultFilter,
} from "./records-filters";
import {
  defaultRecordsGridRequest,
  defaultRecordsQueryString,
  RECORDS_GRID_CAPABILITIES,
  recordsDatasetKey,
  recordsQueryString,
  shouldSeedRecordsPage,
} from "./records-grid-config";
import { buildRecordsReportUrl } from "./report-url";

const LOCATION_A = "11111111-1111-4111-8111-111111111111";
const LOCATION_B = "22222222-2222-4222-8222-222222222222";
const RANGE = { dateFrom: "2026-08-17", dateTo: "2026-08-23" };
const OTHER_RANGE = { dateFrom: "2026-06-01", dateTo: "2026-07-31" };

const LABELS = {
  type: "Type",
  state: "Status",
  result: "Temperature result",
  typeOptions: {
    temperature: "Температура",
    cleaning: "Почистване",
  },
  stateOptions: {
    submitted: "Изпълнена",
    missed: "Пропусната",
    voided: "Анулирана",
    open: "Отворена",
  },
  resultOptions: {
    pass: "В диапазона",
    fail: "Извън диапазона",
    not_evaluated: "Няма измерена температура",
  },
};

describe("grid capabilities", () => {
  it("enables server paging, sorting and filtering only", () => {
    expect(RECORDS_GRID_CAPABILITIES).toEqual({
      pagination: true,
      sorting: true,
      filtering: true,
      search: false,
      selection: false,
      columnVisibility: false,
    });
  });
});

describe("default request and query string", () => {
  it("asks for page 1 at the default size, sorted chronologically", () => {
    expect(defaultRecordsGridRequest()).toEqual({
      page: 1,
      pageSize: GRID_DEFAULT_PAGE_SIZE,
      sortBy: "scheduledAt",
      sortOrder: "asc",
    });
  });

  it("carries no search or filter parameters", () => {
    const request = defaultRecordsGridRequest();

    expect(request).not.toHaveProperty("search");
    expect(request).not.toHaveProperty("filters");
  });

  it("prefixes the required range onto the harness query string", () => {
    expect(defaultRecordsQueryString(RANGE)).toBe(
      "dateFrom=2026-08-17&dateTo=2026-08-23&page=1&pageSize=25&sortBy=scheduledAt&sortOrder=asc",
    );
  });

  it("serializes an unrestricted multi-month range unchanged", () => {
    expect(
      defaultRecordsQueryString({
        dateFrom: "2026-01-01",
        dateTo: "2026-08-23",
      }),
    ).toContain("dateFrom=2026-01-01&dateTo=2026-08-23");
  });

  it("still sends the range when the grid contributes nothing", () => {
    expect(recordsQueryString(RANGE, "")).toBe(
      "dateFrom=2026-08-17&dateTo=2026-08-23",
    );
  });
});

describe("initial-page seeding", () => {
  it("seeds while the active range is still the server-rendered one", () => {
    expect(shouldSeedRecordsPage({ range: RANGE, initialRange: RANGE })).toBe(
      true,
    );
  });

  it("refuses to seed the old page into a new range", () => {
    expect(
      shouldSeedRecordsPage({ range: OTHER_RANGE, initialRange: RANGE }),
    ).toBe(false);
    expect(
      shouldSeedRecordsPage({
        range: { ...RANGE, dateTo: "2026-08-22" },
        initialRange: RANGE,
      }),
    ).toBe(false);
  });
});

describe("query-key isolation", () => {
  function listKey(
    locationId: string,
    range: { dateFrom: string; dateTo: string },
    request: Parameters<typeof buildGridRequest>[0],
  ) {
    return JSON.stringify([
      ...queryKeys.recordsRange(locationId, range.dateFrom, range.dateTo),
      "list",
      buildGridRequest(request),
    ]);
  }

  const base = {
    pageIndex: 0,
    pageSize: 25,
    search: "",
    sorting: null,
    filters: {},
    capabilities: RECORDS_GRID_CAPABILITIES,
    defaultSort: { sortBy: "scheduledAt", sortOrder: "asc" as const },
  };

  it("roots every Records key under the location, for one-shot invalidation", () => {
    expect(queryKeys.records(LOCATION_A)).toEqual(["records", LOCATION_A]);
    expect(
      queryKeys
        .recordsRange(LOCATION_A, RANGE.dateFrom, RANGE.dateTo)
        .slice(0, 2),
    ).toEqual(["records", LOCATION_A]);
  });

  it("gives each location, range, page, sort and filter its own cache entry", () => {
    const reference = listKey(LOCATION_A, RANGE, base);

    expect(listKey(LOCATION_B, RANGE, base)).not.toBe(reference);
    expect(listKey(LOCATION_A, OTHER_RANGE, base)).not.toBe(reference);
    expect(listKey(LOCATION_A, RANGE, { ...base, pageIndex: 1 })).not.toBe(
      reference,
    );
    expect(listKey(LOCATION_A, RANGE, { ...base, pageSize: 50 })).not.toBe(
      reference,
    );
    expect(
      listKey(LOCATION_A, RANGE, {
        ...base,
        sorting: { id: "title", desc: true },
      }),
    ).not.toBe(reference);
    expect(
      listKey(LOCATION_A, RANGE, {
        ...base,
        filters: { type: ["temperature"] },
      }),
    ).not.toBe(reference);
  });

  it("reuses one entry for logically identical filter selections", () => {
    expect(
      listKey(LOCATION_A, RANGE, {
        ...base,
        filters: { state: ["voided", "submitted"] },
      }),
    ).toBe(
      listKey(LOCATION_A, RANGE, {
        ...base,
        filters: { state: ["submitted", "voided"] },
      }),
    );
  });
});

describe("dataset key", () => {
  const request = defaultRecordsGridRequest();
  const reference = recordsDatasetKey({
    locationId: LOCATION_A,
    range: RANGE,
    request,
  });

  it.each([
    ["a location change", { locationId: LOCATION_B, range: RANGE, request }],
    [
      "a date-range change",
      { locationId: LOCATION_A, range: OTHER_RANGE, request },
    ],
    [
      "a page change",
      {
        locationId: LOCATION_A,
        range: RANGE,
        request: { ...request, page: 2 },
      },
    ],
    [
      "a page-size change",
      {
        locationId: LOCATION_A,
        range: RANGE,
        request: { ...request, pageSize: 50 },
      },
    ],
    [
      "a sort change",
      {
        locationId: LOCATION_A,
        range: RANGE,
        request: { ...request, sortBy: "title" },
      },
    ],
    [
      "a filter change",
      {
        locationId: LOCATION_A,
        range: RANGE,
        request: { ...request, filters: { state: ["missed"] } },
      },
    ],
  ])("changes on %s, so an open detail closes", (_label, input) => {
    expect(recordsDatasetKey(input)).not.toBe(reference);
  });

  it("is stable while nothing about the dataset changed", () => {
    expect(
      recordsDatasetKey({
        locationId: LOCATION_A,
        range: { ...RANGE },
        request,
      }),
    ).toBe(reference);
  });
});

describe("temperature-result filter visibility", () => {
  it("appears only for a selection of exactly temperature", () => {
    expect(isTemperatureResultFilterVisible(["temperature"])).toBe(true);
  });

  it.each([
    [undefined],
    [[]],
    [["cleaning"]],
    [["temperature", "cleaning"]],
  ])("stays hidden for %o", (values) => {
    expect(isTemperatureResultFilterVisible(values)).toBe(false);
  });
});

describe("clearing the result filter", () => {
  it("clears result when Type widens past temperature", () => {
    expect(
      shouldClearResultFilter({
        key: "type",
        values: ["temperature", "cleaning"],
        currentResult: ["pass"],
      }),
    ).toBe(true);
  });

  it("clears result when Type is deselected entirely", () => {
    expect(
      shouldClearResultFilter({
        key: "type",
        values: [],
        currentResult: ["pass", "fail"],
      }),
    ).toBe(true);
  });

  it("keeps result while Type stays exactly temperature", () => {
    expect(
      shouldClearResultFilter({
        key: "type",
        values: ["temperature"],
        currentResult: ["pass"],
      }),
    ).toBe(false);
  });

  it("does nothing when there is no result to clear", () => {
    expect(
      shouldClearResultFilter({
        key: "type",
        values: ["cleaning"],
        currentResult: undefined,
      }),
    ).toBe(false);
    expect(
      shouldClearResultFilter({
        key: "type",
        values: ["cleaning"],
        currentResult: [],
      }),
    ).toBe(false);
  });

  it("ignores changes to any other filter", () => {
    expect(
      shouldClearResultFilter({
        key: "state",
        values: ["missed"],
        currentResult: ["pass"],
      }),
    ).toBe(false);
  });
});

describe("filter definitions", () => {
  it("offers Type and Status, and Temperature result only when visible", () => {
    expect(
      buildRecordsFilterDefinitions({ labels: LABELS, showResult: false }).map(
        (definition) => definition.key,
      ),
    ).toEqual([RECORDS_FILTER_KEY.TYPE, RECORDS_FILTER_KEY.STATE]);

    expect(
      buildRecordsFilterDefinitions({ labels: LABELS, showResult: true }).map(
        (definition) => definition.key,
      ),
    ).toEqual([
      RECORDS_FILTER_KEY.TYPE,
      RECORDS_FILTER_KEY.STATE,
      RECORDS_FILTER_KEY.RESULT,
    ]);
  });

  it("labels the outcome control Temperature result, not Result", () => {
    const definition = buildRecordsFilterDefinitions({
      labels: LABELS,
      showResult: true,
    }).find((entry) => entry.key === RECORDS_FILTER_KEY.RESULT);

    expect(definition?.label).toBe("Temperature result");
  });

  it("keeps canonical API values behind translated labels", () => {
    const definitions = buildRecordsFilterDefinitions({
      labels: LABELS,
      showResult: true,
    });

    expect(definitions[0]!.options.map((option) => option.value)).toEqual([
      "temperature",
      "cleaning",
    ]);
    expect(definitions[1]!.options.map((option) => option.value)).toEqual([
      "submitted",
      "missed",
      "voided",
      "open",
    ]);
    expect(definitions[2]!.options.map((option) => option.value)).toEqual([
      "pass",
      "fail",
      "not_evaluated",
    ]);
    expect(definitions[1]!.options.map((option) => option.label)).toContain(
      "Анулирана",
    );
  });

  it("offers no pending status — upcoming work is not a record", () => {
    const statuses = buildRecordsFilterDefinitions({
      labels: LABELS,
      showResult: true,
    })[1]!.options.map((option) => option.value);

    expect(statuses).not.toContain("pending");
  });
});

describe("report URL", () => {
  it("carries the location, range and every selected filter", () => {
    const url = buildRecordsReportUrl({
      locale: "bg",
      locationId: LOCATION_A,
      range: RANGE,
      filters: {
        type: ["temperature"],
        state: ["voided", "submitted"],
        result: ["fail"],
      },
    });

    expect(url).toBe(
      `/records/print?locationId=${LOCATION_A}&dateFrom=2026-08-17&dateTo=2026-08-23&type=temperature&state=submitted%2Cvoided&result=fail`,
    );
  });

  it("omits paging and grid sort — the report is the full filtered dataset", () => {
    const url = buildRecordsReportUrl({
      locale: "bg",
      locationId: LOCATION_A,
      range: RANGE,
      filters: {},
    });

    expect(url).not.toContain("page");
    expect(url).not.toContain("pageSize");
    expect(url).not.toContain("sortBy");
    expect(url).not.toContain("sortOrder");
  });

  it("omits filters that are not selected", () => {
    expect(
      buildRecordsReportUrl({
        locale: "bg",
        locationId: LOCATION_A,
        range: RANGE,
        filters: { type: [], state: ["missed"] },
      }),
    ).toBe(
      `/records/print?locationId=${LOCATION_A}&dateFrom=2026-08-17&dateTo=2026-08-23&state=missed`,
    );
  });

  it("prefixes the locale only when it is not the default", () => {
    const bg = buildRecordsReportUrl({
      locale: "bg",
      locationId: LOCATION_A,
      range: RANGE,
      filters: {},
    });
    const en = buildRecordsReportUrl({
      locale: "en",
      locationId: LOCATION_A,
      range: RANGE,
      filters: {},
    });

    expect(bg.startsWith("/records/print")).toBe(true);
    expect(en.startsWith("/en/records/print")).toBe(true);
  });

  it("stays available for a zero-row result", () => {
    expect(
      buildRecordsReportUrl({
        locale: "bg",
        locationId: LOCATION_A,
        range: { dateFrom: "2019-01-01", dateTo: "2019-01-31" },
        filters: {},
      }),
    ).toContain("dateFrom=2019-01-01");
  });
});

describe("non-temperature presentation", () => {
  const base = {
    occurrenceId: "occ",
    taskTemplateId: "tpl",
    occurrenceDate: "2026-08-23",
    scheduledTime: "08:00",
    availableAt: "2026-08-23T00:00:00.000Z",
    dueAt: "2026-08-23T05:00:00.000Z",
    title: "Clean prep surface",
    equipmentId: null,
    equipmentName: null,
    minTempC: null,
    maxTempC: null,
    displayState: "submitted" as const,
    recordState: "submitted" as const,
    timing: "on_time" as const,
    result: "not_evaluated" as const,
  };

  it("has no reading and no outcome badge for a cleaning row", () => {
    const item = { ...base, type: "cleaning" as const, record: null };

    expect(recordReading(item)).toBeNull();
    expect(hasTemperatureOutcome(item)).toBe(false);
    expect(EM_DASH).toBe("—");
  });

  it("reports the reading for a temperature row", () => {
    const item = {
      ...base,
      type: "temperature" as const,
      result: "pass" as const,
      record: {
        recordId: "rec",
        createdAt: "2026-08-23T04:40:00.000Z",
        createdBy: null,
        recordedAt: "2026-08-23T04:50:00.000Z",
        recordedBy: null,
        voidedAt: null,
        voidedBy: null,
        temperature: {
          recordedC: 3.5,
          minTempC: 0,
          maxTempC: 5,
          result: "ok" as const,
          correctiveAction: null,
        },
      },
    };

    expect(recordReading(item)).toBe(3.5);
    expect(hasTemperatureOutcome(item)).toBe(true);
  });

  it("has no reading for a missed temperature row", () => {
    expect(
      recordReading({ ...base, type: "temperature" as const, record: null }),
    ).toBeNull();
  });
});
