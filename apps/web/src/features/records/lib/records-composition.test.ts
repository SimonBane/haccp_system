import { recordsReportSearchParamsSchema } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import {
  buildRecordsFilterDefinitions,
  RECORDS_FILTER_KEY,
} from "./records-filters";
import {
  defaultRecordsQueryString,
  RECORDS_GRID_CAPABILITIES,
  RECORDS_PAGE_SIZE,
  recordsDatasetKey,
  recordsGridQueryString,
  recordsListBaseQuery,
  recordsPageQueryString,
  shouldSeedRecordsPage,
} from "./records-grid-config";
import { buildRecordsReportUrl } from "./report-url";

const LOCATION_A = "11111111-1111-4111-8111-111111111111";
const LOCATION_B = "22222222-2222-4222-8222-222222222222";
const RANGE = { dateFrom: "2026-08-17", dateTo: "2026-08-23" };
const OTHER_RANGE = { dateFrom: "2026-06-01", dateTo: "2026-07-31" };

const FORM_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const FORM_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TARGET_A = "33333333-3333-4333-8333-333333333333";
const USER_A = "55555555-5555-4555-8555-555555555555";

const LABELS = {
  form: "Check",
  target: "Item",
  recordedBy: "Recorded by",
  status: "Status",
  statusOptions: {
    passed: "Passed",
    attention: "Needs attention",
    recorded: "Recorded",
    missed: "Missed",
    voided: "Voided",
    open: "Open",
  },
  archived: (name: string) => `${name} (archived)`,
  unknownUser: "Unknown user",
};

const OPTIONS = {
  forms: [
    { id: FORM_A, name: "Fridge temperatures", archived: false },
    { id: FORM_B, name: "Old cleaning card", archived: true },
  ],
  targets: [{ id: TARGET_A, name: "Cold room › Floor", archived: false }],
  people: [{ id: USER_A, firstName: "Maria", lastName: "Ivanova" }],
};

describe("list query", () => {
  it("asks for the first page, newest first, with the range and no filters", () => {
    expect(defaultRecordsQueryString(RANGE)).toBe(
      `dateFrom=2026-08-17&dateTo=2026-08-23&sortBy=entryAt&sortOrder=desc&page=1&pageSize=${RECORDS_PAGE_SIZE}`,
    );
  });

  it("serializes filters canonically, so equal selections share one cache entry", () => {
    const a = recordsListBaseQuery({
      range: RANGE,
      filters: { target: [TARGET_A], form: [FORM_B, FORM_A, FORM_A], state: [] },
    });
    const b = recordsListBaseQuery({
      range: RANGE,
      filters: { form: [FORM_A, FORM_B], target: [TARGET_A] },
    });

    expect(a).toBe(b);
    expect(a).toContain(`form=${FORM_A}%2C${FORM_B}`);
    expect(a).not.toContain("state=");
  });

  it("appends the page last, so every page shares the base query", () => {
    const base = recordsListBaseQuery({ range: RANGE, filters: {} });
    expect(recordsPageQueryString(base, 3)).toBe(
      `${base}&page=3&pageSize=${RECORDS_PAGE_SIZE}`,
    );
  });

  it("adds a trimmed search and leaves out an empty one", () => {
    expect(
      recordsListBaseQuery({ range: RANGE, filters: {}, search: "  fridge " }),
    ).toContain("search=fridge");
    expect(
      recordsListBaseQuery({ range: RANGE, filters: {}, search: "   " }),
    ).not.toContain("search=");
  });
});

describe("desktop grid", () => {
  it("pages, sorts, filters and searches on the server, without selection", () => {
    expect(RECORDS_GRID_CAPABILITIES).toEqual({
      pagination: true,
      sorting: true,
      filtering: true,
      search: true,
      selection: false,
      columnVisibility: false,
    });
  });

  it("prefixes the required range onto the grid's query string", () => {
    expect(recordsGridQueryString(RANGE, "page=2&pageSize=25")).toBe(
      "dateFrom=2026-08-17&dateTo=2026-08-23&page=2&pageSize=25",
    );
    expect(recordsGridQueryString(RANGE, "")).toBe(
      "dateFrom=2026-08-17&dateTo=2026-08-23",
    );
  });

  it("changes the dataset key with the location, range and request only", () => {
    const base = {
      locationId: LOCATION_A,
      range: RANGE,
      request: { page: 1, pageSize: 25 },
    };
    expect(recordsDatasetKey(base)).toBe(recordsDatasetKey({ ...base }));
    for (const changed of [
      { ...base, locationId: LOCATION_B },
      { ...base, range: OTHER_RANGE },
      { ...base, request: { page: 2, pageSize: 25 } },
      { ...base, request: { page: 1, pageSize: 25, search: "x" } },
    ]) {
      expect(recordsDatasetKey(changed)).not.toBe(recordsDatasetKey(base));
    }
  });
});

describe("initial-page seeding", () => {
  const initialBaseQuery = recordsListBaseQuery({ range: RANGE, filters: {} });

  it("seeds the server-rendered location and unfiltered range", () => {
    expect(
      shouldSeedRecordsPage({
        locationId: LOCATION_A,
        initialLocationId: LOCATION_A,
        baseQuery: initialBaseQuery,
        initialBaseQuery,
      }),
    ).toBe(true);
  });

  it("refuses another range, a filter or another location", () => {
    for (const input of [
      { locationId: LOCATION_A, baseQuery: recordsListBaseQuery({ range: OTHER_RANGE, filters: {} }) },
      { locationId: LOCATION_A, baseQuery: recordsListBaseQuery({ range: RANGE, filters: { form: [FORM_A] } }) },
      { locationId: LOCATION_B, baseQuery: initialBaseQuery },
    ]) {
      expect(
        shouldSeedRecordsPage({
          ...input,
          initialLocationId: LOCATION_A,
          initialBaseQuery,
        }),
      ).toBe(false);
    }
  });
});

describe("query-key isolation", () => {
  it("roots every Records key under the location, for one-shot invalidation", () => {
    const root = queryKeys.records(LOCATION_A);
    for (const key of [
      queryKeys.recordsGrid(LOCATION_A, "2026-08-17", "2026-08-23"),
      queryKeys.recordsList(LOCATION_A, "q"),
      queryKeys.recordsJournals(LOCATION_A, "q"),
      queryKeys.recordsFilterOptions(LOCATION_A),
    ]) {
      expect(key.slice(0, root.length)).toEqual(root);
    }
  });

  it("gives each location and query its own entry", () => {
    expect(queryKeys.recordsList(LOCATION_A, "q")).not.toEqual(
      queryKeys.recordsList(LOCATION_B, "q"),
    );
    expect(queryKeys.recordsList(LOCATION_A, "q")).not.toEqual(
      queryKeys.recordsList(LOCATION_A, "q&search=x"),
    );
  });
});

describe("facet definitions", () => {
  it("offers Check, Item, Recorded by and Status once the options load", () => {
    expect(
      buildRecordsFilterDefinitions({ labels: LABELS, options: OPTIONS }).map(
        (definition) => definition.key,
      ),
    ).toEqual([
      RECORDS_FILTER_KEY.FORM,
      RECORDS_FILTER_KEY.TARGET,
      RECORDS_FILTER_KEY.RECORDED_BY,
      RECORDS_FILTER_KEY.OUTCOME,
    ]);
  });

  it("offers Status alone before the options load, with canonical values", () => {
    const [status] = buildRecordsFilterDefinitions({
      labels: LABELS,
      options: undefined,
    });
    expect(status?.key).toBe(RECORDS_FILTER_KEY.OUTCOME);
    expect(status?.options.map((option) => option.value)).toEqual([
      "passed",
      "attention",
      "recorded",
      "missed",
      "voided",
      "open",
    ]);
  });

  it("leaves out a facet with nothing to choose", () => {
    expect(
      buildRecordsFilterDefinitions({
        labels: LABELS,
        options: { ...OPTIONS, people: [] },
      }).map((definition) => definition.key),
    ).toEqual([
      RECORDS_FILTER_KEY.FORM,
      RECORDS_FILTER_KEY.TARGET,
      RECORDS_FILTER_KEY.OUTCOME,
    ]);
  });

  it("sends ids and labels archived checks", () => {
    const [forms] = buildRecordsFilterDefinitions({
      labels: LABELS,
      options: OPTIONS,
    });
    expect(forms?.options).toEqual([
      { value: FORM_A, label: "Fridge temperatures" },
      { value: FORM_B, label: "Old cleaning card (archived)" },
    ]);
  });
});

describe("report URL", () => {
  it("carries items left out of a journal as sorted pairs", () => {
    const url = buildRecordsReportUrl({
      locale: "bg",
      locationId: LOCATION_A,
      range: RANGE,
      filters: {},
      exclude: [
        { formId: FORM_B, targetId: TARGET_A },
        { formId: FORM_A, targetId: TARGET_A },
      ],
    });
    const params = new URLSearchParams(url.split("?")[1]!);
    expect(params.get("exclude")).toBe(`${FORM_A}:${TARGET_A},${FORM_B}:${TARGET_A}`);
    expect(
      recordsReportSearchParamsSchema.parse(Object.fromEntries(params)).exclude,
    ).toEqual([
      { formId: FORM_A, targetId: TARGET_A },
      { formId: FORM_B, targetId: TARGET_A },
    ]);
  });

  it("carries the location, range and every selected filter", () => {
    const url = buildRecordsReportUrl({
      locale: "bg",
      locationId: LOCATION_A,
      range: RANGE,
      filters: {
        category: ["temperature"],
        state: ["voided", "submitted"],
        result: ["fail"],
      },
    });

    expect(url).toBe(
      `/records/print?locationId=${LOCATION_A}&dateFrom=2026-08-17&dateTo=2026-08-23&category=temperature&state=submitted%2Cvoided&result=fail`,
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
        filters: { category: [], state: ["missed"] },
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

  it("serializes state=open, which is a report state like any other", () => {
    expect(
      buildRecordsReportUrl({
        locale: "bg",
        locationId: LOCATION_A,
        range: RANGE,
        filters: { state: ["open"] },
      }),
    ).toBe(
      `/records/print?locationId=${LOCATION_A}&dateFrom=2026-08-17&dateTo=2026-08-23&state=open`,
    );
  });

  /** The handoff is only correct if the print page can parse what the grid emits. */
  it("emits a link the report page parses back to the same canonical filters", () => {
    const url = buildRecordsReportUrl({
      locale: "bg",
      locationId: LOCATION_A,
      range: RANGE,
      filters: { state: ["open", "missed"], category: ["cleaning"] },
    });

    const parsed = recordsReportSearchParamsSchema.safeParse(
      Object.fromEntries(new URLSearchParams(url.split("?")[1]!)),
    );

    expect(parsed.success).toBe(true);
    expect(parsed.data).toMatchObject({
      locationId: LOCATION_A,
      dateFrom: "2026-08-17",
      dateTo: "2026-08-23",
      state: ["missed", "open"],
      category: ["cleaning"],
    });
  });

  it("carries the check, item and person filters", () => {
    const url = buildRecordsReportUrl({
      locale: "bg",
      locationId: LOCATION_A,
      range: RANGE,
      filters: {
        form: [FORM_B, FORM_A],
        target: [TARGET_A],
        recordedBy: [USER_A],
      },
    });

    const parsed = recordsReportSearchParamsSchema.parse(
      Object.fromEntries(new URLSearchParams(url.split("?")[1]!)),
    );
    expect(parsed).toMatchObject({
      form: [FORM_A, FORM_B],
      target: [TARGET_A],
      recordedBy: [USER_A],
      layout: "list",
    });
  });

  it("names the layout only when it is not the default list", () => {
    const base = {
      locale: "bg" as const,
      locationId: LOCATION_A,
      range: RANGE,
      filters: {},
    };

    expect(buildRecordsReportUrl({ ...base, layout: "list" })).not.toContain(
      "layout",
    );
    expect(buildRecordsReportUrl({ ...base, layout: "journals" })).toContain(
      "layout=journals",
    );
    expect(buildRecordsReportUrl({ ...base, layout: "deviations" })).toContain(
      "layout=deviations",
    );
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
