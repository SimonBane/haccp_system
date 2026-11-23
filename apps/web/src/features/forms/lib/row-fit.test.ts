import { describe, expect, it } from "vitest";
import { fitsOneRow } from "./row-fit";

describe("fitsOneRow", () => {
  it("fits natural widths side by side when their sum and gaps fit", () => {
    expect(fitsOneRow([60, 100], { gap: 8, available: 168 })).toBe(true);
    expect(fitsOneRow([60, 100], { gap: 8, available: 167 })).toBe(false);
  });

  it("sizes every item to the widest when the row is split equally", () => {
    expect(fitsOneRow([60, 100], { gap: 8, available: 208, equal: true })).toBe(
      true,
    );
    expect(fitsOneRow([60, 100], { gap: 8, available: 207, equal: true })).toBe(
      false,
    );
  });

  it("treats no items as fitting", () => {
    expect(fitsOneRow([], { gap: 8, available: 0, equal: true })).toBe(true);
  });
});
