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

describe("check, item and person filters", () => {
  const FORM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const TARGET_ID = "33333333-3333-4333-8333-333333333333";
  const USER_ID = "55555555-5555-4555-8555-555555555555";

  it("filters both branches by the form, not the form version", () => {
    for (const branch of [recordBranch, occurrenceBranch]) {
      const { sql, params } = branch({ form: [FORM_ID] })!;
      expect(sql).toContain('"forms"."id" in ');
      expect(sql).not.toContain('"form_versions"."id" in ');
      expect(params).toContain(FORM_ID);
    }
  });

  it("filters each branch by its own item snapshot", () => {
    expect(recordBranch({ target: [TARGET_ID] })!.sql).toContain(
      '"task_records"."target_id" in ',
    );
    expect(occurrenceBranch({ target: [TARGET_ID] })!.sql).toContain(
      '"task_occurrences"."target_id" in ',
    );
  });

  it("filters records by who recorded them and rules out unrecorded occurrences", () => {
    const { sql, params } = recordBranch({ recordedBy: [USER_ID] })!;
    expect(sql).toContain('"task_records"."recorded_by_user_id" in ');
    expect(params).toContain(USER_ID);
    expect(occurrenceBranch({ recordedBy: [USER_ID] })).toBeNull();
  });

  it("treats an empty list as no filter", () => {
    expect(recordBranch({ form: [], target: [], recordedBy: [] })!.sql).toBe(
      recordBranch()!.sql,
    );
    expect(occurrenceBranch({ recordedBy: [] })).not.toBeNull();
  });
});

describe("timing filter", () => {
  it("keeps only submitted records recorded after their occurrence's deadline", () => {
    const { sql } = recordBranch({ timing: ["late"] })!;

    expect(sql).toContain('"task_records"."voided_at" is null');
    expect(sql).toContain('"task_occurrences"."due_at" is not null');
    expect(sql).toContain(
      '"task_records"."recorded_at" > "task_occurrences"."due_at"',
    );
  });

  it("rules out unrecorded occurrences, which have no submission to be late", () => {
    expect(occurrenceBranch({ timing: ["late"] })).toBeNull();
  });

  it("treats an empty list as no filter", () => {
    expect(recordBranch({ timing: [] })!.sql).toBe(recordBranch()!.sql);
    expect(occurrenceBranch({ timing: [] })).not.toBeNull();
  });
});

describe("exclude filter", () => {
  const PAIR = {
    formId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    targetId: "33333333-3333-4333-8333-333333333333",
  };
  const OTHER = {
    formId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    targetId: "44444444-4444-4444-8444-444444444444",
  };

  it("drops a form's item on each branch's own snapshot, never a row with no item", () => {
    for (const [branch, column] of [
      [recordBranch, '"task_records"."target_id"'],
      [occurrenceBranch, '"task_occurrences"."target_id"'],
    ] as const) {
      const { sql, params } = branch({ exclude: [PAIR] })!;
      expect(sql).toContain(`(${column} is null or not (`);
      expect(sql).toContain(`"forms"."id" = $`);
      expect(sql).toContain(`${column} = $`);
      expect(params).toEqual(
        expect.arrayContaining([PAIR.formId, PAIR.targetId]),
      );
    }
  });

  it("drops every listed pair, and only as pairs", () => {
    const { sql, params } = recordBranch({ exclude: [PAIR, OTHER] })!;

    expect(
      sql.match(
        /"forms"\."id" = \$\d+ and "task_records"\."target_id" = \$\d+/g,
      ),
    ).toHaveLength(2);
    expect(sql).not.toContain('"forms"."id" in ');
    expect(params).toEqual(
      expect.arrayContaining([
        PAIR.formId,
        PAIR.targetId,
        OTHER.formId,
        OTHER.targetId,
      ]),
    );
  });

  it("treats an empty or missing list as no filter", () => {
    expect(recordBranch({ exclude: [] })!.sql).toBe(recordBranch()!.sql);
    expect(occurrenceBranch({ exclude: undefined })!.sql).toBe(
      occurrenceBranch()!.sql,
    );
  });
});

describe("search", () => {
  it("matches the check or the item name snapshot on each branch, case-insensitively", () => {
    for (const [branch, table] of [
      [recordBranch, '"task_records"'],
      [occurrenceBranch, '"task_occurrences"'],
    ] as const) {
      const { sql, params } = branch({ search: "Fridge" })!;
      expect(sql).toMatch(
        new RegExp(
          `\\(${table}\\."title" ilike \\$\\d+ escape '\\\\' or ${table}\\."target_name" ilike \\$\\d+ escape '\\\\'\\)`,
        ),
      );
      expect(sql).not.toContain("Fridge");
      expect(params).toContain("%Fridge%");
    }
  });

  it("escapes wildcards and the escape character so they match literally", () => {
    expect(recordBranch({ search: "50%_a\\b" })!.params).toContain(
      "%50\\%\\_a\\\\b%",
    );
  });

  it("treats a missing search as no filter", () => {
    expect(recordBranch({ search: undefined })!.sql).toBe(recordBranch()!.sql);
  });
});

describe("outcome filter", () => {
  it("maps passed, attention and recorded onto live records with that result", () => {
    for (const [outcome, result] of [
      ["passed", "pass"],
      ["attention", "fail"],
      ["recorded", "not_evaluated"],
    ] as const) {
      const { sql, params } = recordBranch({ outcome: [outcome] })!;
      expect(sql).toContain(
        '("task_records"."voided_at" is null and "task_records"."result" = $',
      );
      expect(params).toContain(result);
    }
  });

  it("maps voided onto voided records, whatever their result", () => {
    const { sql } = recordBranch({ outcome: ["voided"] })!;
    expect(sql).toContain('"task_records"."voided_at" is not null');
    expect(sql).not.toContain('"task_records"."result"');
  });

  it("maps missed and open onto unrecorded occurrences only", () => {
    expect(occurrenceBranch({ outcome: ["missed"] })!.sql).toContain(
      '"task_occurrences"."due_at" is not null)',
    );
    expect(occurrenceBranch({ outcome: ["open"] })!.sql).toContain(
      '"task_occurrences"."due_at" is null)',
    );
    expect(recordBranch({ outcome: ["missed", "open"] })).toBeNull();
    expect(
      occurrenceBranch({
        outcome: ["passed", "attention", "recorded", "voided"],
      }),
    ).toBeNull();
  });

  it("ors the selected outcomes and keeps both branches when they span them", () => {
    const { sql } = recordBranch({
      outcome: ["attention", "voided", "missed"],
    })!;
    expect(sql).toMatch(
      /\("task_records"\."voided_at" is null and "task_records"\."result" = \$\d+\) or "task_records"\."voided_at" is not null/,
    );
    expect(
      occurrenceBranch({ outcome: ["attention", "missed"] }),
    ).not.toBeNull();
  });

  it("narrows alongside the state, result and timing filters", () => {
    const { sql } = recordBranch({
      outcome: ["passed"],
      category: ["cleaning"],
    })!;
    expect(sql).toContain('"forms"."category" in ');
    expect(sql).toContain('"task_records"."result" = $');
    expect(
      recordBranch({ outcome: ["passed"], timing: ["late"] })!.sql,
    ).toContain('"task_records"."recorded_at" > "task_occurrences"."due_at"');
  });

  it("treats an empty list as no filter", () => {
    expect(recordBranch({ outcome: [] })!.sql).toBe(recordBranch()!.sql);
    expect(occurrenceBranch({ outcome: [] })).not.toBeNull();
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
