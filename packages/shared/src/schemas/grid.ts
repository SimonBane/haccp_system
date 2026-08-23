import { z } from "zod";

export const GRID_DEFAULT_PAGE_SIZE = 25;
export const GRID_MAX_PAGE_SIZE = 100;
export const GRID_MIN_PAGE_SIZE = 1;
export const GRID_PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100];
export const GRID_MAX_SEARCH_LENGTH = 100;

export const SORT_ORDER = {
  ASC: "asc",
  DESC: "desc",
} as const;

export const sortOrderSchema = z.enum([
  SORT_ORDER.ASC,
  SORT_ORDER.DESC,
]);

export type SortOrder = z.infer<typeof sortOrderSchema>;

export type GridPage<TItem> = {
  items: TItem[];
  total: number;
};

export function createGridPageSchema<TItem extends z.ZodType>(
  itemSchema: TItem,
) {
  return z.object({
    items: z.array(itemSchema),
    total: z.int().nonnegative(),
  });
}

const pageNumberSchema = z.coerce.number().int().min(1).optional();

const pageSizeSchema = z.coerce
  .number()
  .int()
  .min(GRID_MIN_PAGE_SIZE)
  .max(GRID_MAX_PAGE_SIZE)
  .optional();

const searchSchema = z
  .string()
  .trim()
  .max(GRID_MAX_SEARCH_LENGTH)
  .optional()
  .transform((value) => (value === undefined || value === "" ? undefined : value));

export function createGridFilterSchema<const TValues extends readonly [string, ...string[]]>(
  values: TValues,
) {
  const valueSchema = z.enum(values);

  return z
    .string()
    .optional()
    .transform((raw) =>
      raw === undefined
        ? []
        : raw
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part !== ""),
    )
    .pipe(z.array(valueSchema))
    .transform((parsed) =>
      parsed.length === 0
        ? undefined
        : [...new Set(parsed)].sort(),
    );
}

export type GridFilterSchemas = Record<string, z.ZodType>;

export function createGridQuerySchema<
  const TSortFields extends readonly [string, ...string[]],
  TFilters extends GridFilterSchemas = Record<never, never>,
>(options: { sortFields: TSortFields; filters?: TFilters }) {
  return z
    .strictObject({
      page: pageNumberSchema,
      pageSize: pageSizeSchema,
      search: searchSchema,
      sortBy: z.enum(options.sortFields).optional(),
      sortOrder: sortOrderSchema.default(SORT_ORDER.ASC),
      ...((options.filters ?? {}) as TFilters),
    })
    .check((ctx) => {
      const { page, pageSize } = ctx.value as {
        page?: number;
        pageSize?: number;
      };

      if ((page === undefined) !== (pageSize === undefined)) {
        ctx.issues.push({
          code: "custom",
          message: "page and pageSize must be provided together",
          path: [page === undefined ? "page" : "pageSize"],
          input: ctx.value,
        });
      }
    });
}

export type GridQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder: SortOrder;
};
