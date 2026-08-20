import { describe, expect, it } from "vitest";
import { taskRecordInputSchema } from "./task-record.js";

describe("taskRecordInputSchema", () => {
  it("accepts an ordinary record with no value payload", () => {
    const result = taskRecordInputSchema.safeParse({ kind: "ordinary" });
    expect(result.success).toBe(true);
  });

  it("accepts a temperature record with an in-range reading and no corrective action", () => {
    const result = taskRecordInputSchema.safeParse({
      kind: "temperature",
      recordedC: 3,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a temperature record with a corrective action", () => {
    const result = taskRecordInputSchema.safeParse({
      kind: "temperature",
      recordedC: 12,
      correctiveAction: "Moved stock to backup fridge",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    const result = taskRecordInputSchema.safeParse({ kind: "other" });
    expect(result.success).toBe(false);
  });

  it("rejects a temperature record missing recordedC", () => {
    const result = taskRecordInputSchema.safeParse({ kind: "temperature" });
    expect(result.success).toBe(false);
  });

  it("rejects a reading below -99.9°C", () => {
    const result = taskRecordInputSchema.safeParse({
      kind: "temperature",
      recordedC: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a reading above 99.9°C", () => {
    const result = taskRecordInputSchema.safeParse({
      kind: "temperature",
      recordedC: 100,
    });
    expect(result.success).toBe(false);
  });

  it("accepts the boundary readings -99.9 and 99.9", () => {
    expect(
      taskRecordInputSchema.safeParse({ kind: "temperature", recordedC: -99.9 })
        .success,
    ).toBe(true);
    expect(
      taskRecordInputSchema.safeParse({ kind: "temperature", recordedC: 99.9 })
        .success,
    ).toBe(true);
  });

  it("coerces a numeric-string reading", () => {
    const result = taskRecordInputSchema.safeParse({
      kind: "temperature",
      recordedC: "3.5",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "temperature") {
      expect(result.data.recordedC).toBe(3.5);
    }
  });

  it("trims a corrective action", () => {
    const result = taskRecordInputSchema.safeParse({
      kind: "temperature",
      recordedC: 12,
      correctiveAction: "  Moved stock  ",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "temperature") {
      expect(result.data.correctiveAction).toBe("Moved stock");
    }
  });
});
