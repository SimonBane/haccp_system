import { describe, expect, it } from "vitest";
import {
  clampPageIndex,
  gridPageCount,
  lastPageIndex,
} from "./grid-pagination";

describe("gridPageCount", () => {
  it("counts whole and partial pages", () => {
    expect(gridPageCount(50, 25)).toBe(2);
    expect(gridPageCount(51, 25)).toBe(3);
    expect(gridPageCount(1, 25)).toBe(1);
  });

  it("reports one page for zero rows rather than zero", () => {
    expect(gridPageCount(0, 25)).toBe(1);
    expect(lastPageIndex(0, 25)).toBe(0);
  });

  it("survives a zero page size", () => {
    expect(gridPageCount(10, 0)).toBe(1);
  });
});

describe("clampPageIndex", () => {
  it("leaves a valid page alone", () => {
    expect(clampPageIndex(1, 60, 25)).toBe(1);
  });

  it("pulls a stranded page back to the last valid one", () => {
    expect(clampPageIndex(5, 26, 25)).toBe(1);
  });

  it("clamps to the first page when nothing matches", () => {
    expect(clampPageIndex(3, 0, 25)).toBe(0);
    expect(clampPageIndex(-1, 100, 25)).toBe(0);
  });
});
