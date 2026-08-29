import { describe, expect, it } from "vitest";
import {
  createTaskTemplateSchema,
  TASK_TEMPLATE_COMPLETION_DUE_AFTER_DEFAULT_MINUTES,
  TASK_TEMPLATE_COMPLETION_MINUTES_MAX,
  TASK_TEMPLATE_COMPLETION_MINUTES_MIN,
  TASK_TEMPLATE_COMPLETION_OPENS_BEFORE_DEFAULT_MINUTES,
} from "./task-template.js";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Morning check",
    type: "cleaning",
    weekdays: ["monday"],
    scheduledTimes: ["08:00"],
    ...overrides,
  };
}

describe("completion window bounds", () => {
  it("defaults completionOpensBeforeMinutes to 1440 and completionDueAfterMinutes to 0 when omitted", () => {
    const parsed = createTaskTemplateSchema.parse(baseInput());

    expect(parsed.completionOpensBeforeMinutes).toBe(
      TASK_TEMPLATE_COMPLETION_OPENS_BEFORE_DEFAULT_MINUTES,
    );
    expect(parsed.completionDueAfterMinutes).toBe(
      TASK_TEMPLATE_COMPLETION_DUE_AFTER_DEFAULT_MINUTES,
    );
  });

  it("accepts the full 0-1440 minute range for completionOpensBeforeMinutes", () => {
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({ completionOpensBeforeMinutes: TASK_TEMPLATE_COMPLETION_MINUTES_MIN }),
      ).success,
    ).toBe(true);
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({ completionOpensBeforeMinutes: TASK_TEMPLATE_COMPLETION_MINUTES_MAX }),
      ).success,
    ).toBe(true);
  });

  it("rejects completionOpensBeforeMinutes outside 0-1440", () => {
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({ completionOpensBeforeMinutes: -1 }),
      ).success,
    ).toBe(false);
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({ completionOpensBeforeMinutes: 1441 }),
      ).success,
    ).toBe(false);
  });

  it("rejects a non-integer completionOpensBeforeMinutes", () => {
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({ completionOpensBeforeMinutes: 30.5 }),
      ).success,
    ).toBe(false);
  });

  it("accepts the full 0-1440 minute range for a finite completionDueAfterMinutes", () => {
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({ completionDueAfterMinutes: TASK_TEMPLATE_COMPLETION_MINUTES_MIN }),
      ).success,
    ).toBe(true);
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({ completionDueAfterMinutes: TASK_TEMPLATE_COMPLETION_MINUTES_MAX }),
      ).success,
    ).toBe(true);
  });

  it("rejects completionDueAfterMinutes outside 0-1440", () => {
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({ completionDueAfterMinutes: -1 }),
      ).success,
    ).toBe(false);
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({ completionDueAfterMinutes: 1441 }),
      ).success,
    ).toBe(false);
  });

  it("rejects a non-integer completionDueAfterMinutes", () => {
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({ completionDueAfterMinutes: 15.5 }),
      ).success,
    ).toBe(false);
  });

  it("accepts a null completionDueAfterMinutes as Never overdue, with no second flag required", () => {
    const parsed = createTaskTemplateSchema.parse(
      baseInput({ completionDueAfterMinutes: null }),
    );

    expect(parsed.completionDueAfterMinutes).toBeNull();
  });

  it("never accepts a null completionOpensBeforeMinutes — only the deadline can be absent", () => {
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({ completionOpensBeforeMinutes: null }),
      ).success,
    ).toBe(false);
  });
});
