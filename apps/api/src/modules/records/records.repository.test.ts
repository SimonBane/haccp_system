import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { recordsQueryInternals } from "./records.repository.js";

const dialect = new PgDialect();

function render(query: Parameters<PgDialect["sqlToQuery"]>[0]) {
  return dialect.sqlToQuery(query);
}

const SCOPE = {
  locationId: "11111111-1111-4111-8111-111111111111",
  organizationId: "22222222-2222-4222-8222-222222222222",
  dateFrom: "2026-08-17",
  dateTo: "2026-08-23",
  now: new Date("2026-08-23T09:00:00.000Z"),
};

describe("base condition", () => {
  const { sql, params } = render(recordsQueryInternals.baseCondition(SCOPE));

  it("scopes to the location and to the organization that owns it", () => {
    expect(sql).toContain('"task_occurrences"."location_id" = ');
    expect(sql).toContain('"locations"."organization_id" = ');
    expect(params).toContain(SCOPE.locationId);
    expect(params).toContain(SCOPE.organizationId);
  });

  it("bounds the range inclusively on both ends", () => {
    expect(sql).toContain('"task_occurrences"."occurrence_date" >= ');
    expect(sql).toContain('"task_occurrences"."occurrence_date" <= ');
    expect(params).toContain(SCOPE.dateFrom);
    expect(params).toContain(SCOPE.dateTo);
  });

  it("includes a row once a record exists or the due time has passed", () => {
    expect(sql).toContain(
      '("task_records"."id" is not null or "task_occurrences"."due_at" <= ',
    );
    // The captured instant travels as a bound parameter, not a database clock call.
    expect(params).toContain(SCOPE.now.toISOString());
  });

  it("uses the captured now, never the database clock", () => {
    expect(sql).not.toContain("now()");
    expect(sql).not.toContain("current_timestamp");
  });
});

describe("display-state predicates", () => {
  it("treats submitted as an existing, non-voided record", () => {
    expect(
      render(recordsQueryInternals.displayStateCondition("submitted")).sql,
    ).toBe(
      '("task_records"."id" is not null and "task_records"."voided_at" is null)',
    );
  });

  it("treats voided as a retained record with a void timestamp", () => {
    expect(
      render(recordsQueryInternals.displayStateCondition("voided")).sql,
    ).toBe(
      '("task_records"."id" is not null and "task_records"."voided_at" is not null)',
    );
  });

  it("treats missed as the absence of a record — the base predicate already made it due", () => {
    expect(
      render(recordsQueryInternals.displayStateCondition("missed")).sql,
    ).toBe('"task_records"."id" is null');
  });
});

describe("result predicates", () => {
  it("maps pass and fail onto the stored temperature result", () => {
    const pass = render(recordsQueryInternals.resultCondition("pass"));
    const fail = render(recordsQueryInternals.resultCondition("fail"));

    expect(pass.sql).toBe('"task_record_temperatures"."result" = $1');
    expect(pass.params).toEqual(["ok"]);
    expect(fail.params).toEqual(["out_of_range"]);
  });

  it("maps not_evaluated onto a missing temperature detail", () => {
    expect(
      render(recordsQueryInternals.resultCondition("not_evaluated")).sql,
    ).toBe('"task_record_temperatures"."task_record_id" is null');
  });
});

describe("filter composition", () => {
  it("is absent when no optional filter is selected", () => {
    expect(recordsQueryInternals.filterCondition({})).toBeUndefined();
    expect(
      recordsQueryInternals.filterCondition({
        type: [],
        state: [],
        result: [],
      }),
    ).toBeUndefined();
  });

  it("ORs values inside one filter", () => {
    const { sql } = render(
      recordsQueryInternals.filterCondition({
        state: ["submitted", "voided"],
      })!,
    );

    expect(sql).toContain(" or ");
    expect(sql).not.toContain(" and (");
  });

  it("ANDs different filters together", () => {
    const { sql, params } = render(
      recordsQueryInternals.filterCondition({
        type: ["temperature", "cleaning"],
        state: ["voided"],
        result: ["fail"],
      })!,
    );

    expect(sql).toContain('"task_occurrences"."type" in ');
    expect(sql).toContain('"task_records"."voided_at" is not null');
    expect(sql).toContain('"task_record_temperatures"."result" = ');
    expect(params).toEqual(
      expect.arrayContaining(["temperature", "cleaning", "out_of_range"]),
    );
  });

  it("parameterizes every filter value instead of interpolating it", () => {
    const { sql } = render(
      recordsQueryInternals.filterCondition({ type: ["temperature"] })!,
    );

    expect(sql).not.toContain("temperature");
  });
});

describe("ordering", () => {
  function terms(
    sortBy: "scheduledAt" | "title",
    sortOrder: "asc" | "desc",
  ): string[] {
    return recordsQueryInternals
      .orderByTerms(sortBy, sortOrder)
      .map((term) => render(term).sql);
  }

  it("sorts scheduledAt by date then time in the requested direction", () => {
    expect(terms("scheduledAt", "asc")).toEqual([
      '"task_occurrences"."occurrence_date" asc',
      '"task_occurrences"."scheduled_time" asc',
      '"task_occurrences"."id" asc',
    ]);
    expect(terms("scheduledAt", "desc")).toEqual([
      '"task_occurrences"."occurrence_date" desc',
      '"task_occurrences"."scheduled_time" desc',
      '"task_occurrences"."id" asc',
    ]);
  });

  it("sorts title in the requested direction, then chronologically", () => {
    expect(terms("title", "desc")).toEqual([
      '"task_occurrences"."title" desc',
      '"task_occurrences"."occurrence_date" asc',
      '"task_occurrences"."scheduled_time" asc',
      '"task_occurrences"."id" asc',
    ]);
  });

  it("always ends on the occurrence id, so limit/offset paging is stable", () => {
    for (const sortBy of ["scheduledAt", "title"] as const) {
      for (const sortOrder of ["asc", "desc"] as const) {
        expect(terms(sortBy, sortOrder).at(-1)).toBe(
          '"task_occurrences"."id" asc',
        );
      }
    }
  });

  it("never interpolates the client sort value as an identifier", () => {
    for (const sortBy of ["scheduledAt", "title"] as const) {
      for (const term of terms(sortBy, "asc")) {
        expect(term).toMatch(/^"task_occurrences"\."[a-z_]+" (asc|desc)$/);
      }
    }
  });
});
