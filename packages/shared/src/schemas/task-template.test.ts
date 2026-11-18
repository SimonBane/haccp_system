import { describe, expect, it } from "vitest";
import {
  createTaskTemplateSchema,
  TASK_TEMPLATE_COMPLETION_DUE_AFTER_DEFAULT_MINUTES,
  TASK_TEMPLATE_COMPLETION_MINUTES_MAX,
  TASK_TEMPLATE_COMPLETION_MINUTES_MIN,
  TASK_TEMPLATE_COMPLETION_OPENS_BEFORE_DEFAULT_MINUTES,
} from "./task-template.js";

const FORM_ID = "11111111-1111-4111-8111-111111111111";
const TARGET_A = "22222222-2222-4222-8222-222222222222";
const TARGET_B = "33333333-3333-4333-8333-333333333333";

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Morning check",
    formId: FORM_ID,
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
        baseInput({
          completionOpensBeforeMinutes: TASK_TEMPLATE_COMPLETION_MINUTES_MIN,
        }),
      ).success,
    ).toBe(true);
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({
          completionOpensBeforeMinutes: TASK_TEMPLATE_COMPLETION_MINUTES_MAX,
        }),
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
        baseInput({
          completionDueAfterMinutes: TASK_TEMPLATE_COMPLETION_MINUTES_MIN,
        }),
      ).success,
    ).toBe(true);
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({
          completionDueAfterMinutes: TASK_TEMPLATE_COMPLETION_MINUTES_MAX,
        }),
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

describe("targets", () => {
  it("defaults to no targets and an empty override map per target", () => {
    const parsed = createTaskTemplateSchema.parse(
      baseInput({ targets: [{ targetId: TARGET_A }] }),
    );

    expect(parsed.targets).toEqual([
      { targetId: TARGET_A, limitOverrides: {} },
    ]);
    expect(createTaskTemplateSchema.parse(baseInput()).targets).toEqual([]);
  });

  it("accepts per-target limit overrides keyed by field id", () => {
    const parsed = createTaskTemplateSchema.parse(
      baseInput({
        targets: [
          {
            targetId: TARGET_A,
            limitOverrides: { temperature: { min: 0, max: 2 } },
          },
          { targetId: TARGET_B },
        ],
      }),
    );

    expect(parsed.targets[0]?.limitOverrides).toEqual({
      temperature: { min: 0, max: 2 },
    });
  });

  it("rejects the same target twice", () => {
    expect(
      createTaskTemplateSchema.safeParse(
        baseInput({
          targets: [{ targetId: TARGET_A }, { targetId: TARGET_A }],
        }),
      ).success,
    ).toBe(false);
  });

  it("requires a form", () => {
    expect(
      createTaskTemplateSchema.safeParse(baseInput({ formId: undefined }))
        .success,
    ).toBe(false);
  });
});
