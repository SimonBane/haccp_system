import { describe, expect, it } from "vitest";
import { selectionRangeIds } from "./selection-range";

/**
 * Shift-click ranges are computed against the rows as rendered, so the cases
 * that matter are the ones where rendered order diverges from the caller's
 * intuition: dragging a range upwards, and an anchor a filter or page change
 * has since taken off screen.
 */
const rows = (...ids: string[]) =>
  ids.map((id) => ({ id, getCanSelect: () => true }));

describe("selectionRangeIds", () => {
  it("spans the rows between the anchor and the clicked row", () => {
    expect(selectionRangeIds(rows("a", "b", "c", "d"), "a", "c")).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("spans the same rows when the range is drawn upwards", () => {
    expect(selectionRangeIds(rows("a", "b", "c", "d"), "c", "a")).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("returns just the row when the anchor is the row itself", () => {
    expect(selectionRangeIds(rows("a", "b", "c"), "b", "b")).toEqual(["b"]);
  });

  it("has nothing to extend from without an anchor", () => {
    expect(selectionRangeIds(rows("a", "b", "c"), null, "b")).toBeNull();
  });

  it("has nothing to extend from once the anchor is off screen", () => {
    // The anchor was filtered or paged away since it was clicked.
    expect(selectionRangeIds(rows("a", "b", "c"), "z", "b")).toBeNull();
  });

  it("skips rows that cannot be selected without breaking the span", () => {
    const mixed = [
      { id: "a", getCanSelect: () => true },
      { id: "b", getCanSelect: () => false },
      { id: "c", getCanSelect: () => true },
    ];

    expect(selectionRangeIds(mixed, "a", "c")).toEqual(["a", "c"]);
  });
});
