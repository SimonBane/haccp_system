import type { TaskTemplateResponse } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  builderSections,
  draftFromTask,
  draftTimes,
  draftWindowFields,
  emptyDraft,
  missingSteps,
} from "./task-draft";

const TARGET_ID = "00000000-0000-4000-8000-0000000000f1";

function makeTask(overrides: Partial<TaskTemplateResponse> = {}): TaskTemplateResponse {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    locationId: "00000000-0000-4000-8000-000000000002",
    formId: "00000000-0000-4000-8000-000000000003",
    formName: "Hot holding",
    formCategory: "temperature",
    weekdays: ["wednesday", "monday"],
    scheduledTimes: ["13:00", "11:00", "15:00"],
    targets: [{ targetId: TARGET_ID, targetName: "Bain-marie" }],
    completionOpensBeforeMinutes: 15,
    completionDueAfterMinutes: 30,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("emptyDraft", () => {
  it("starts every day with no times and no window", () => {
    const draft = emptyDraft();
    expect(draft.weekdays).toHaveLength(7);
    expect(draftTimes(draft)).toEqual([]);
    expect(draftWindowFields(draft)).toEqual({
      completionOpensBeforeMinutes: 1440,
      completionDueAfterMinutes: null,
    });
  });
});

describe("draftFromTask", () => {
  it("reopens the times in order and keeps the window", () => {
    const draft = draftFromTask(makeTask());
    expect(draftTimes(draft)).toEqual(["11:00", "13:00", "15:00"]);
    expect(draft.weekdays).toEqual(["monday", "wednesday"]);
    expect(draftWindowFields(draft)).toEqual({
      completionOpensBeforeMinutes: 15,
      completionDueAfterMinutes: 30,
    });
  });

  it("reads an always-available task as no window", () => {
    const draft = draftFromTask(
      makeTask({
        scheduledTimes: ["08:00", "09:30"],
        completionOpensBeforeMinutes: 1440,
        completionDueAfterMinutes: null,
      }),
    );
    expect(draft.times).toEqual(["08:00", "09:30"]);
    expect(draft.windowOn).toBe(false);
  });
});

describe("builderSections", () => {
  it("skips the targets step for a form that checks nothing specific", () => {
    expect(builderSections("location")).toEqual(["form", "when", "window"]);
  });

  it("keeps it for a per-item form and before a form is chosen", () => {
    expect(builderSections("per_item")).toEqual(["form", "targets", "when", "window"]);
    expect(builderSections(null)).toEqual(["form", "targets", "when", "window"]);
  });
});

describe("missingSteps", () => {
  it("lists every blocker of a fresh draft", () => {
    expect(missingSteps(emptyDraft(), null, new Set())).toEqual(["form", "times"]);
  });

  it("needs a selected target that still exists", () => {
    const draft = { ...draftFromTask(makeTask()), formId: "f" };
    expect(missingSteps(draft, "per_item", new Set([TARGET_ID]))).toEqual([]);
    expect(missingSteps(draft, "per_item", new Set())).toEqual(["targets"]);
  });

  it("does not ask for targets on a whole-location form", () => {
    const draft = { ...draftFromTask(makeTask({ targets: [] })), formId: "f" };
    expect(missingSteps(draft, "location", new Set())).toEqual([]);
  });

  it("flags a task with no times", () => {
    const draft = { ...draftFromTask(makeTask()), times: [] };
    expect(missingSteps(draft, "per_item", new Set([TARGET_ID]))).toEqual(["times"]);
  });
});
