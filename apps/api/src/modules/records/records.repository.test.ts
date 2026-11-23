import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  recordsQueryInternals,
  type RecordsFilters,
} from "./records.repository.js";

const dialect = new PgDialect();

function render(query: SQL) {
  return dialect.sqlToQuery(query);
}

const SCOPE = {
  locationId: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  dateFrom: "2026-08-17",
  dateTo: "2026-08-23",
  now: new Date("2026-08-23T09:00:00.000Z"),
};

function recordBranch(filters: RecordsFilters = {}) {
  const where = recordsQueryInternals.recordBranchCondition({
    scope: SCOPE,
    filters,
  });
  return where === null ? null : render(where);
}

function occurrenceBranch(filters: RecordsFilters = {}) {
  const where = recordsQueryInternals.occurrenceBranchCondition({
    scope: SCOPE,
    filters,
  });
  return where === null ? null : render(where);
}

describe("record branch", () => {
  const { sql, params } = recordBranch()!;

  it("scopes records to the location, its organization and the entry date range", () => {
    expect(sql).toContain('"task_records"."location_id" = ');
    expect(sql).toContain('"locations"."organization_id" = ');
    expect(sql).toContain('"task_records"."entry_date" >= ');
    expect(sql).toContain('"task_records"."entry_date" <= ');
    expect(params).toEqual(
      expect.arrayContaining([
        SCOPE.locationId,
        SCOPE.organizationId,
        SCOPE.dateFrom,
        SCOPE.dateTo,
      ]),
    );
  });

  it("includes on-demand records, which have no occurrence to wait for", () => {
    expect(sql).not.toContain("occurrence_id");
    expect(sql).not.toContain("due_at");
  });
});

describe("occurrence branch", () => {
  const { sql, params } = occurrenceBranch()!;

  it("scopes occurrences to the location, its organization and the date range", () => {
    expect(sql).toContain('"task_occurrences"."location_id" = ');
    expect(sql).toContain('"locations"."organization_id" = ');
    expect(sql).toContain('"task_occurrences"."occurrence_date" >= ');
    expect(sql).toContain('"task_occurrences"."occurrence_date" <= ');
  });

  it("only lists occurrences that have no record", () => {
    expect(sql).toContain("not exists (select 1 from");
    expect(sql).toContain(
      '"task_records"."occurrence_id" = "task_occurrences"."id"',
    );
  });

  it("includes one once a finite deadline has passed, or a no-deadline one has opened", () => {
    expect(sql).toContain(
      '("task_occurrences"."due_at" is not null and "task_occurrences"."due_at" <= ',
    );
    expect(sql).toContain(
      '("task_occurrences"."due_at" is null and "task_occurrences"."available_at" <= ',
    );
    expect(params).toContain(SCOPE.now.toISOString());
  });

  it("uses the captured now, never the database clock", () => {
    expect(sql).not.toContain("now()");
    expect(sql).not.toContain("current_timestamp");
  });
});

describe("state filter", () => {
  it("maps submitted and voided onto records only", () => {
    expect(recordBranch({ state: ["submitted"] })!.sql).toContain(
      '"task_records"."voided_at" is null',
    );
    expect(recordBranch({ state: ["voided"] })!.sql).toContain(
      '"task_records"."voided_at" is not null',
    );
    expect(occurrenceBranch({ state: ["submitted", "voided"] })).toBeNull();
  });

  it("maps missed and open onto unrecorded occurrences only", () => {
    expect(occurrenceBranch({ state: ["missed"] })!.sql).toContain(
      '"task_occurrences"."due_at" is not null)',
    );
    expect(recordBranch({ state: ["missed", "open"] })).toBeNull();
  });

  it("keeps both branches when the selection spans them", () => {
    expect(recordBranch({ state: ["submitted", "missed"] })).not.toBeNull();
    expect(occurrenceBranch({ state: ["submitted", "missed"] })).not.toBeNull();
  });
});

describe("result filter", () => {
  it("maps pass and fail onto the stored record result and rules out unrecorded occurrences", () => {
    const { sql, params } = recordBranch({ result: ["pass", "fail"] })!;

    expect(sql).toContain('"task_records"."result" in ');
    expect(params).toEqual(expect.arrayContaining(["pass", "fail"]));
    expect(occurrenceBranch({ result: ["pass", "fail"] })).toBeNull();
  });

  it("maps not_evaluated onto records judged so and every unrecorded occurrence", () => {
    expect(recordBranch({ result: ["not_evaluated"] })!.params).toContain(
      "not_evaluated",
    );
    expect(occurrenceBranch({ result: ["not_evaluated"] })!.sql).not.toContain(
      "result",
    );
  });
});

describe("category filter", () => {
  it("applies to both branches and is parameterized", () => {
    for (const branch of [recordBranch, occurrenceBranch]) {
      const { sql, params } = branch({ category: ["temperature"] })!;
      expect(sql).toContain('"forms"."category" in ');
      expect(sql).not.toContain("temperature");
      expect(params).toContain("temperature");
    }
  });
});

describe("ordering", () => {
  function terms(
    sortBy: "entryAt" | "title",
    sortOrder: "asc" | "desc",
  ): string[] {
    return recordsQueryInternals
      .orderByTerms(sortBy, sortOrder)
      .map((term) => render(term).sql);
  }

  it("sorts entryAt by date then time in the requested direction", () => {
    expect(terms("entryAt", "asc")).toEqual([
      '"row_entry_date" asc',
      '"row_entry_time" asc',
      '"row_id" asc',
    ]);
    expect(terms("entryAt", "desc")).toEqual([
      '"row_entry_date" desc',
      '"row_entry_time" desc',
      '"row_id" asc',
    ]);
  });

  it("sorts title in the requested direction, then chronologically", () => {
    expect(terms("title", "desc")).toEqual([
      '"row_title" desc',
      '"row_entry_date" asc',
      '"row_entry_time" asc',
      '"row_id" asc',
    ]);
  });

  it("always ends on the row id, so limit/offset paging is stable", () => {
    for (const sortBy of ["entryAt", "title"] as const) {
      for (const sortOrder of ["asc", "desc"] as const) {
        expect(terms(sortBy, sortOrder).at(-1)).toBe('"row_id" asc');
      }
    }
  });
});
