import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  GRID_DEFAULT_PAGE_SIZE,
  GRID_MAX_PAGE_SIZE,
  GRID_MAX_SEARCH_LENGTH,
  GRID_PAGE_SIZE_OPTIONS,
  createGridFilterSchema,
  createGridPageSchema,
  createGridQuerySchema,
  sortOrderSchema,
} from "./grid.js";

const querySchema = createGridQuerySchema({
  sortFields: ["name", "type"] as const,
  filters: {
    type: createGridFilterSchema(["fridge", "freezer", "display_case"] as const),
  },
});

function parse(query: Record<string, string>) {
  return querySchema.safeParse(query);
}

describe("grid constants", () => {
  it("pins the default and maximum page size the UI and API agree on", () => {
    expect(GRID_DEFAULT_PAGE_SIZE).toBe(25);
    expect(GRID_MAX_PAGE_SIZE).toBe(100);
    expect(GRID_MAX_SEARCH_LENGTH).toBe(100);
    expect(GRID_PAGE_SIZE_OPTIONS).toEqual([10, 25, 50, 100]);
  });

  it("offers only page sizes the API accepts", () => {
    for (const option of GRID_PAGE_SIZE_OPTIONS) {
      expect(parse({ page: "1", pageSize: String(option) }).success).toBe(true);
    }
  });
});

describe("numeric coercion", () => {
  it("coerces the string query parameters to numbers", () => {
    const result = parse({ page: "3", pageSize: "50" });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ page: 3, pageSize: 50 });
  });

  it.each(["abc", "", "1.5", "0", "-2", " ", "2px"])(
    "rejects %o as a page number",
    (page) => {
      expect(parse({ page, pageSize: "25" }).success).toBe(false);
    },
  );
});

describe("paired page and pageSize", () => {
  it("treats both absent as an unpaged request", () => {
    const result = parse({});
    expect(result.success).toBe(true);
    expect(result.data?.page).toBeUndefined();
    expect(result.data?.pageSize).toBeUndefined();
  });

  it("rejects page without pageSize", () => {
    const result = parse({ page: "1" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["pageSize"]);
  });

  it("rejects pageSize without page", () => {
    const result = parse({ pageSize: "25" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["page"]);
  });
});

describe("page size bounds", () => {
  it("accepts the boundary values", () => {
    expect(parse({ page: "1", pageSize: "1" }).success).toBe(true);
    expect(
      parse({ page: "1", pageSize: String(GRID_MAX_PAGE_SIZE) }).success,
    ).toBe(true);
  });

  it("rejects a page size above the maximum", () => {
    expect(
      parse({ page: "1", pageSize: String(GRID_MAX_PAGE_SIZE + 1) }).success,
    ).toBe(false);
  });

  it("rejects a page size below one", () => {
    expect(parse({ page: "1", pageSize: "0" }).success).toBe(false);
  });
});

describe("search normalization", () => {
  it("trims surrounding whitespace", () => {
    expect(parse({ search: "  freezer  " }).data?.search).toBe("freezer");
  });

  it("normalizes blank input to absent", () => {
    expect(parse({ search: "   " }).data?.search).toBeUndefined();
    expect(parse({ search: "" }).data?.search).toBeUndefined();
  });

  it("accepts exactly the maximum length and rejects one more", () => {
    expect(parse({ search: "a".repeat(GRID_MAX_SEARCH_LENGTH) }).success).toBe(
      true,
    );
    expect(
      parse({ search: "a".repeat(GRID_MAX_SEARCH_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it("keeps literal wildcard characters — escaping is the repository's job", () => {
    expect(parse({ search: "100%_off" }).data?.search).toBe("100%_off");
  });
});

describe("sorting", () => {
  it("accepts an allowlisted field", () => {
    expect(parse({ sortBy: "type", sortOrder: "desc" }).data).toMatchObject({
      sortBy: "type",
      sortOrder: "desc",
    });
  });

  it("rejects a field outside the allowlist", () => {
    expect(parse({ sortBy: "createdAt" }).success).toBe(false);
    expect(parse({ sortBy: "name; drop table equipment" }).success).toBe(false);
  });

  it("rejects a sort direction outside asc/desc", () => {
    expect(parse({ sortOrder: "sideways" }).success).toBe(false);
    expect(parse({ sortOrder: "ASC" }).success).toBe(false);
  });

  it("defaults the direction to ascending", () => {
    expect(parse({ sortBy: "name" }).data?.sortOrder).toBe("asc");
  });

  it("exposes only asc and desc", () => {
    expect(sortOrderSchema.options).toEqual(["asc", "desc"]);
  });
});

describe("unknown query parameters", () => {
  it("rejects anything outside the contract", () => {
    expect(parse({ orderBy: "name" }).success).toBe(false);
    expect(parse({ page: "1", pageSize: "25", limit: "500" }).success).toBe(
      false,
    );
  });
});

describe("filter parsing", () => {
  it("parses a comma-separated list", () => {
    expect(parse({ type: "fridge,freezer" }).data?.type).toEqual([
      "freezer",
      "fridge",
    ]);
  });

  it("deduplicates and sorts deterministically", () => {
    const a = parse({ type: "freezer,fridge,freezer" }).data?.type;
    const b = parse({ type: "fridge,freezer" }).data?.type;
    expect(a).toEqual(b);
    expect(a).toEqual(["freezer", "fridge"]);
  });

  it("tolerates padding around values", () => {
    expect(parse({ type: " fridge , freezer " }).data?.type).toEqual([
      "freezer",
      "fridge",
    ]);
  });

  it("omits an empty filter rather than matching nothing", () => {
    expect(parse({ type: "" }).data?.type).toBeUndefined();
    expect(parse({ type: " , " }).data?.type).toBeUndefined();
    expect(parse({}).data?.type).toBeUndefined();
  });

  it("rejects a value outside the allowlist", () => {
    expect(parse({ type: "fridge,microwave" }).success).toBe(false);
  });
});

describe("page response", () => {
  const pageSchema = createGridPageSchema(z.object({ id: z.string() }));

  it("parses items and a total", () => {
    expect(
      pageSchema.parse({ items: [{ id: "a" }], total: 42 }),
    ).toEqual({ items: [{ id: "a" }], total: 42 });
  });

  it("accepts an empty page with a zero total", () => {
    expect(pageSchema.parse({ items: [], total: 0 }).total).toBe(0);
  });

  it("rejects a negative or fractional total", () => {
    expect(pageSchema.safeParse({ items: [], total: -1 }).success).toBe(false);
    expect(pageSchema.safeParse({ items: [], total: 1.5 }).success).toBe(false);
  });

  it("requires the total", () => {
    expect(pageSchema.safeParse({ items: [] }).success).toBe(false);
  });

  it("tolerates unknown response fields so an older client keeps parsing", () => {
    expect(
      pageSchema.safeParse({ items: [], total: 0, nextCursor: "x" }).success,
    ).toBe(true);
  });
});
