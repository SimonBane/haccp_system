import type { CreateTaskTemplateInput, FormDefinition } from "@haccp/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";

const taskTemplateRepository = vi.hoisted(() => ({
  findManyActiveWithFormByLocation: vi.fn(),
  findActiveWithFormById: vi.fn(),
  findTargetsByTemplateIds: vi.fn(),
  findActiveFormForLocation: vi.fn(),
  findActiveTargetIdsAtLocation: vi.fn(),
  insert: vi.fn(),
  updateActiveByIdAndLocation: vi.fn(),
  replaceTargets: vi.fn(),
  archiveByIdAndLocation: vi.fn(),
}));
const taskOccurrenceService = vi.hoisted(() => ({
  reconcileTemplate: vi.fn(),
}));

vi.mock("./task-template.repository.js", () => ({ taskTemplateRepository }));
vi.mock("../task-occurrences/task-occurrence.service.js", () => ({
  taskOccurrenceService,
}));

const { taskTemplateService } = await import("./task-template.service.js");

const LOCATION_ID = "00000000-0000-4000-8000-0000000000a1";
const FORM_ID = "00000000-0000-4000-8000-0000000000b1";
const TARGET_ID = "00000000-0000-4000-8000-0000000000c1";
const OTHER_TARGET_ID = "00000000-0000-4000-8000-0000000000c2";
const TEMPLATE_ID = "00000000-0000-4000-8000-0000000000d1";

const FRIDGE: FormDefinition = {
  fields: [
    {
      id: "temperature",
      type: "measurement",
      label: "Temperature",
      required: true,
      unit: "celsius",
      limits: { min: 0, max: 5 },
    },
    {
      id: "door_closed",
      type: "checkbox",
      label: "Door closed",
      required: true,
    },
  ],
  correctiveAction: "required_on_fail",
};

const templateRow = {
  id: TEMPLATE_ID,
  locationId: LOCATION_ID,
  title: "Morning check",
  formId: FORM_ID,
  weekdays: ["monday"],
  scheduledTimes: ["08:00"],
  completionOpensBeforeMinutes: 1440,
  completionDueAfterMinutes: 0,
  archivedAt: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
};

function input(
  overrides: Partial<CreateTaskTemplateInput> = {},
): CreateTaskTemplateInput {
  return {
    title: "Morning check",
    formId: FORM_ID,
    weekdays: ["monday"],
    scheduledTimes: ["08:00"],
    targets: [{ targetId: TARGET_ID, limitOverrides: {} }],
    completionOpensBeforeMinutes: 1440,
    completionDueAfterMinutes: 0,
    ...overrides,
  };
}

// `tx` inside the service is this same object, so `toHaveBeenCalledWith(db, ...)` holds.
const dbHandle: { transaction: (fn: (tx: unknown) => unknown) => unknown } = {
  transaction: (fn) => fn(dbHandle),
};
const db = dbHandle as never;

beforeEach(() => {
  vi.clearAllMocks();
  taskTemplateRepository.findActiveFormForLocation.mockResolvedValue({
    formId: FORM_ID,
    formName: "Fridge check",
    formCategory: "temperature",
    definition: FRIDGE,
  });
  taskTemplateRepository.findActiveTargetIdsAtLocation.mockResolvedValue(
    new Set([TARGET_ID]),
  );
  taskTemplateRepository.insert.mockResolvedValue(templateRow);
  taskTemplateRepository.updateActiveByIdAndLocation.mockResolvedValue(
    templateRow,
  );
  taskTemplateRepository.findActiveWithFormById.mockResolvedValue({
    template: templateRow,
    formName: "Fridge check",
    formCategory: "temperature",
  });
  taskTemplateRepository.findTargetsByTemplateIds.mockResolvedValue([
    {
      taskTemplateId: TEMPLATE_ID,
      targetId: TARGET_ID,
      targetName: "Fish fridge",
      limitOverrides: {},
    },
  ]);
});

describe("taskTemplateService.create", () => {
  it("rejects a form that is archived or from another organisation, without inserting", async () => {
    taskTemplateRepository.findActiveFormForLocation.mockResolvedValue(null);

    await expect(
      taskTemplateService.create(db, LOCATION_ID, input()),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(taskTemplateRepository.insert).not.toHaveBeenCalled();
  });

  it("rejects a target that is not active at this location, without inserting", async () => {
    await expect(
      taskTemplateService.create(
        db,
        LOCATION_ID,
        input({
          targets: [
            { targetId: TARGET_ID, limitOverrides: {} },
            { targetId: OTHER_TARGET_ID, limitOverrides: {} },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(
      taskTemplateRepository.findActiveTargetIdsAtLocation,
    ).toHaveBeenCalledWith(db, LOCATION_ID, [TARGET_ID, OTHER_TARGET_ID]);
    expect(taskTemplateRepository.insert).not.toHaveBeenCalled();
  });

  it("rejects an override for a field that is not a measurement", async () => {
    await expect(
      taskTemplateService.create(
        db,
        LOCATION_ID,
        input({
          targets: [
            {
              targetId: TARGET_ID,
              limitOverrides: { door_closed: { min: 0, max: 1 } },
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects an override with min above max", async () => {
    await expect(
      taskTemplateService.create(
        db,
        LOCATION_ID,
        input({
          targets: [
            {
              targetId: TARGET_ID,
              limitOverrides: { temperature: { min: 4, max: 2 } },
            },
          ],
        }),
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("inserts, links its targets and reconciles in one transaction", async () => {
    const targets = [
      {
        targetId: TARGET_ID,
        limitOverrides: { temperature: { min: 0, max: 2 } },
      },
    ];

    const result = await taskTemplateService.create(
      db,
      LOCATION_ID,
      input({ targets }),
    );

    expect(taskTemplateRepository.insert).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        locationId: LOCATION_ID,
        formId: FORM_ID,
        completionOpensBeforeMinutes: 1440,
        completionDueAfterMinutes: 0,
      }),
    );
    expect(taskTemplateRepository.replaceTargets).toHaveBeenCalledWith(
      db,
      TEMPLATE_ID,
      LOCATION_ID,
      targets,
    );
    expect(taskOccurrenceService.reconcileTemplate).toHaveBeenCalledWith(
      db,
      LOCATION_ID,
      TEMPLATE_ID,
    );
    expect(result).toMatchObject({
      id: TEMPLATE_ID,
      formName: "Fridge check",
      targets: [{ targetId: TARGET_ID, targetName: "Fish fridge" }],
    });
  });

  it("accepts a template with no targets", async () => {
    taskTemplateRepository.findActiveTargetIdsAtLocation.mockResolvedValue(
      new Set(),
    );

    await taskTemplateService.create(db, LOCATION_ID, input({ targets: [] }));

    expect(taskTemplateRepository.replaceTargets).toHaveBeenCalledWith(
      db,
      TEMPLATE_ID,
      LOCATION_ID,
      [],
    );
  });
});

describe("taskTemplateService.update", () => {
  it("is not found for an archived or foreign template, without touching its targets", async () => {
    taskTemplateRepository.updateActiveByIdAndLocation.mockResolvedValue(null);

    await expect(
      taskTemplateService.update(db, LOCATION_ID, TEMPLATE_ID, input()),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(taskTemplateRepository.replaceTargets).not.toHaveBeenCalled();
  });

  it("replaces the targets and reconciles", async () => {
    await taskTemplateService.update(db, LOCATION_ID, TEMPLATE_ID, input());

    expect(taskTemplateRepository.replaceTargets).toHaveBeenCalledWith(
      db,
      TEMPLATE_ID,
      LOCATION_ID,
      [{ targetId: TARGET_ID, limitOverrides: {} }],
    );
    expect(taskOccurrenceService.reconcileTemplate).toHaveBeenCalledWith(
      db,
      LOCATION_ID,
      TEMPLATE_ID,
    );
  });
});

describe("taskTemplateService.delete", () => {
  it("archives the template rather than deleting it", async () => {
    taskTemplateRepository.archiveByIdAndLocation.mockResolvedValue({
      id: TEMPLATE_ID,
    });

    await taskTemplateService.delete(db, LOCATION_ID, TEMPLATE_ID);

    expect(taskTemplateRepository.archiveByIdAndLocation).toHaveBeenCalledWith(
      db,
      LOCATION_ID,
      TEMPLATE_ID,
    );
  });

  it("raises NotFound for an unknown or already-archived template", async () => {
    taskTemplateRepository.archiveByIdAndLocation.mockResolvedValue(null);

    await expect(
      taskTemplateService.delete(db, LOCATION_ID, TEMPLATE_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
