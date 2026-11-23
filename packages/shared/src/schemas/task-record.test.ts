import { describe, expect, it } from "vitest";
import {
  onDemandRecordInputSchema,
  taskRecordInputSchema,
  taskRecordResponseSchema,
} from "./task-record.js";

describe("taskRecordInputSchema", () => {
  it("accepts answers keyed by field id", () => {
    const result = taskRecordInputSchema.safeParse({
      values: { temperature: 3.2, cleaned: true, decision: "accepted" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty answer set for a mark-as-done form", () => {
    expect(taskRecordInputSchema.safeParse({ values: {} }).success).toBe(true);
  });

  it("rejects answers that are objects", () => {
    const result = taskRecordInputSchema.safeParse({
      values: { temperature: { value: 3 } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a field id with spaces", () => {
    const result = taskRecordInputSchema.safeParse({
      values: { "bad id": 1 },
    });
    expect(result.success).toBe(false);
  });

  it("trims a corrective action", () => {
    const result = taskRecordInputSchema.safeParse({
      values: {},
      correctiveAction: "  Moved stock  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.correctiveAction).toBe("Moved stock");
    }
  });
});

describe("taskRecordResponseSchema — removed M0 fields", () => {
  it("does not expose organizationId, locationId, last-edited fields, or a void reason", () => {
    const keys = Object.keys(taskRecordResponseSchema.shape);

    expect(keys).not.toContain("organizationId");
    expect(keys).not.toContain("locationId");
    expect(keys).not.toContain("lastEditedAt");
    expect(keys).not.toContain("lastEditedByUserId");
    expect(keys).not.toContain("voidReason");
  });
});

describe("onDemandRecordInputSchema", () => {
  const base = {
    values: { cleaned: true },
    formVersionId: "11111111-1111-4111-8111-111111111111",
    targetId: null,
    entryDate: "2026-11-19",
    entryTime: "09:30",
  };

  it("accepts a location-level entry", () => {
    expect(onDemandRecordInputSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an impossible date or a malformed time", () => {
    expect(
      onDemandRecordInputSchema.safeParse({ ...base, entryDate: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      onDemandRecordInputSchema.safeParse({ ...base, entryTime: "9:30" }).success,
    ).toBe(false);
  });
});
