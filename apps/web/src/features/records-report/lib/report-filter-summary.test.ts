import type { RecordsReportSearchParams } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import type { RecordsFilterLabels } from "@/features/records/lib/records-filters";
import { buildReportFilterSummary } from "./report-filter-summary";

const LABELS: RecordsFilterLabels = {
  type: "Вид",
  state: "Статус",
  result: "Температурен резултат",
  typeOptions: { temperature: "Температура", cleaning: "Почистване" },
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

function params(
  overrides: Partial<RecordsReportSearchParams> = {},
): RecordsReportSearchParams {
  return {
    locationId: "11111111-1111-4111-8111-111111111111",
    dateFrom: "2026-08-17",
    dateTo: "2026-08-23",
    type: undefined,
    state: undefined,
    result: undefined,
    ...overrides,
  };
}

describe("buildReportFilterSummary", () => {
  it("reports no entries when nothing is filtered", () => {
    expect(
      buildReportFilterSummary({ params: params(), labels: LABELS }),
    ).toEqual([]);
  });

  it("translates each selected value without touching the canonical query", () => {
    const input = params({ state: ["missed", "open"], type: ["temperature"] });

    expect(buildReportFilterSummary({ params: input, labels: LABELS })).toEqual(
      [
        { label: "Вид", values: ["Температура"] },
        { label: "Статус", values: ["Пропусната", "Отворена"] },
      ],
    );
    expect(input.state).toEqual(["missed", "open"]);
  });

  it("summarizes a temperature outcome selection", () => {
    expect(
      buildReportFilterSummary({
        params: params({ result: ["fail"] }),
        labels: LABELS,
      }),
    ).toEqual([
      { label: "Температурен резултат", values: ["Извън диапазона"] },
    ]);
  });
});
