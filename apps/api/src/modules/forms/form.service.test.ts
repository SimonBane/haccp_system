import {
  API_ERROR_CODE,
  type FormDefinition,
  type FormField,
} from "@haccp/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../core/errors/app-errors.js";

const formRepository = vi.hoisted(() => ({
  findManyActiveWithLatestVersion: vi.fn(),
  findActiveWithLatestVersion: vi.fn(),
  insertForm: vi.fn(),
  insertVersion: vi.fn(),
  updateActive: vi.fn(),
  archiveIfUnused: vi.fn(),
  countActiveTemplatesByForm: vi.fn(),
  findActiveTemplateIdsByForm: vi.fn(),
  findTemplateOverridesByForm: vi.fn(),
  findTemplateTargetCountsByForm: vi.fn(),
  setLimitOverrides: vi.fn(),
}));
const taskOccurrenceService = vi.hoisted(() => ({
  reconcileTemplateIds: vi.fn(),
}));

vi.mock("./form.repository.js", () => ({ formRepository }));
vi.mock("../task-occurrences/task-occurrence.service.js", () => ({
  taskOccurrenceService,
}));

const { formService } = await import("./form.service.js");

const ORG_ID = "00000000-0000-4000-8000-0000000000a1";
const FORM_ID = "00000000-0000-4000-8000-0000000000d1";
const VERSION_1_ID = "00000000-0000-4000-8000-0000000000e1";
const VERSION_2_ID = "00000000-0000-4000-8000-0000000000e2";
const TEMPLATE_ID = "00000000-0000-4000-8000-0000000000f1";
const TARGET_ID = "00000000-0000-4000-8000-0000000000c1";
const LOCATION_ID = "00000000-0000-4000-8000-0000000000b1";
const TIME_ZONE = "Europe/Sofia";

const dbHandle: { transaction: (fn: (tx: unknown) => unknown) => unknown } = {
  transaction: (fn) => fn(dbHandle),
};
const db = dbHandle as never;

const temperature: FormField = {
  id: "temperature",
  type: "measurement",
  label: "Temperature",
  required: true,
  unit: "celsius",
  limits: { min: 0, max: 5 },
};
const doorClosed: FormField = {
  id: "door_closed",
  type: "checkbox",
  label: "Door closed",
  required: true,
};

const v1: FormDefinition = {
  fields: [temperature],
  correctiveAction: "required_on_fail",
};

const formRow = {
  id: FORM_ID,
  organizationId: ORG_ID,
  name: "Fridge check",
  category: "temperature",
  appliesTo: "per_item",
  onDemand: false,
  archivedAt: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
};

function versionRow(id: string, version: number, definition: FormDefinition) {
  return {
    id,
    formId: FORM_ID,
    version,
    definition,
    createdAt: new Date("2026-10-01T00:00:00Z"),
  };
}

const overrideRow = {
  templateId: TEMPLATE_ID,
  locationId: LOCATION_ID,
  locationName: "Main kitchen",
  targetId: TARGET_ID,
  targetName: "Fish fridge",
  limitOverrides: { temperature: { min: 0, max: 2 } },
};

beforeEach(() => {
  vi.clearAllMocks();
  formRepository.findActiveWithLatestVersion.mockResolvedValue({
    form: formRow,
    latestVersion: versionRow(VERSION_1_ID, 1, v1),
  });
  formRepository.findTemplateOverridesByForm.mockResolvedValue([]);
  formRepository.findActiveTemplateIdsByForm.mockResolvedValue([TEMPLATE_ID]);
  formRepository.insertVersion.mockImplementation(async (_db, data) =>
    versionRow(VERSION_2_ID, data.version, data.definition),
  );
});

describe("formService.list", () => {
  const unusedRow = { ...formRow, id: "00000000-0000-4000-8000-0000000000d2" };

  it("counts each form's active templates in one batched lookup, zero when unused", async () => {
    formRepository.findManyActiveWithLatestVersion.mockResolvedValue([
      { form: formRow, latestVersion: versionRow(VERSION_1_ID, 1, v1) },
      { form: unusedRow, latestVersion: versionRow(VERSION_2_ID, 1, v1) },
    ]);
    formRepository.countActiveTemplatesByForm.mockResolvedValue(
      new Map([[FORM_ID, 3]]),
    );

    const { items } = await formService.list(db, ORG_ID);

    expect(formRepository.countActiveTemplatesByForm).toHaveBeenCalledTimes(1);
    expect(formRepository.countActiveTemplatesByForm).toHaveBeenCalledWith(db, [
      FORM_ID,
      unusedRow.id,
    ]);
    expect(items.map((item) => item.templateCount)).toEqual([3, 0]);
  });
});

describe("formService.create", () => {
  it("creates the form with version 1 in one transaction", async () => {
    formRepository.insertForm.mockResolvedValue(formRow);
    formRepository.insertVersion.mockResolvedValue(
      versionRow(VERSION_1_ID, 1, v1),
    );

    const created = await formService.create(db, ORG_ID, {
      name: "Fridge check",
      category: "temperature",
      appliesTo: "per_item",
      onDemand: false,
      definition: v1,
    });

    expect(formRepository.insertVersion).toHaveBeenCalledWith(db, {
      formId: FORM_ID,
      version: 1,
      definition: v1,
    });
    expect(created.latestVersion).toMatchObject({ version: 1, definition: v1 });
  });

  it("maps a duplicate active name to FORM_NAME_EXISTS", async () => {
    formRepository.insertForm.mockRejectedValue({ code: "23505" });

    await expect(
      formService.create(db, ORG_ID, {
        name: "Fridge check",
        category: "temperature",
        appliesTo: "per_item",
        onDemand: false,
        definition: v1,
      }),
    ).rejects.toMatchObject({ code: API_ERROR_CODE.FORM_NAME_EXISTS });
  });
});

describe("formService.update", () => {
  const input = {
    name: "Fridge check",
    category: "temperature" as const,
    appliesTo: "location" as const,
  };

  it("saves a new applies-to when every task still fits it", async () => {
    formRepository.updateActive.mockResolvedValue({ id: FORM_ID });
    formRepository.findTemplateTargetCountsByForm.mockResolvedValue([
      { templateId: TEMPLATE_ID, targetCount: 0 },
    ]);

    await formService.update(db, ORG_ID, TIME_ZONE, FORM_ID, input);

    expect(formRepository.updateActive).toHaveBeenCalledWith(
      db,
      ORG_ID,
      FORM_ID,
      expect.objectContaining({ appliesTo: "location" }),
    );
  });

  it("refuses whole-location while a task still checks targets", async () => {
    formRepository.findTemplateTargetCountsByForm.mockResolvedValue([
      { templateId: TEMPLATE_ID, targetCount: 0 },
      { templateId: "00000000-0000-4000-8000-0000000000e2", targetCount: 2 },
    ]);

    await expect(
      formService.update(db, ORG_ID, TIME_ZONE, FORM_ID, {
        ...input,
        appliesTo: "location",
      }),
    ).rejects.toMatchObject({ code: API_ERROR_CODE.FORM_APPLIES_TO_IN_USE });
  });

  it("keeps the on-demand setting when the update leaves it out", async () => {
    formRepository.updateActive.mockResolvedValue({ id: FORM_ID });
    formRepository.findActiveWithLatestVersion.mockResolvedValueOnce({
      form: { ...formRow, onDemand: true },
      latestVersion: versionRow(VERSION_1_ID, 1, v1),
    });

    await formService.update(db, ORG_ID, TIME_ZONE, FORM_ID, {
      ...input,
      appliesTo: "per_item",
    });

    expect(formRepository.updateActive).toHaveBeenCalledWith(
      db,
      ORG_ID,
      FORM_ID,
      expect.objectContaining({ onDemand: true }),
    );
  });

  it("turns logging when needed on and off", async () => {
    formRepository.updateActive.mockResolvedValue({ id: FORM_ID });

    await formService.update(db, ORG_ID, TIME_ZONE, FORM_ID, {
      ...input,
      appliesTo: "per_item",
      onDemand: true,
    });

    expect(formRepository.updateActive).toHaveBeenCalledWith(
      db,
      ORG_ID,
      FORM_ID,
      expect.objectContaining({ onDemand: true }),
    );
  });

  it("skips the check when applies-to is unchanged", async () => {
    formRepository.updateActive.mockResolvedValue({ id: FORM_ID });

    await formService.update(db, ORG_ID, TIME_ZONE, FORM_ID, {
      ...input,
      appliesTo: "per_item",
    });

    expect(formRepository.findTemplateTargetCountsByForm).not.toHaveBeenCalled();
  });

  it("renames the upcoming checks of tasks using a renamed form", async () => {
    formRepository.updateActive.mockResolvedValue({ id: FORM_ID });

    await formService.update(db, ORG_ID, TIME_ZONE, FORM_ID, {
      ...input,
      name: "Fridge temperature",
      appliesTo: "per_item",
    });

    expect(taskOccurrenceService.reconcileTemplateIds).toHaveBeenCalledWith(db, {
      templateIds: [TEMPLATE_ID],
      timeZone: TIME_ZONE,
    });
  });

  it("leaves upcoming checks alone when the name is unchanged", async () => {
    formRepository.updateActive.mockResolvedValue({ id: FORM_ID });

    await formService.update(db, ORG_ID, TIME_ZONE, FORM_ID, {
      ...input,
      appliesTo: "per_item",
    });

    expect(taskOccurrenceService.reconcileTemplateIds).not.toHaveBeenCalled();
  });

  it("is not found for an archived or foreign form", async () => {
    formRepository.findActiveWithLatestVersion.mockResolvedValue(null);

    await expect(
      formService.update(db, ORG_ID, TIME_ZONE, FORM_ID, input),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("formService.createVersion", () => {
  it("locks the form, publishes the next version and moves upcoming occurrences to it", async () => {
    const v2: FormDefinition = { ...v1, fields: [temperature, doorClosed] };

    await formService.createVersion(db, ORG_ID, TIME_ZONE, FORM_ID, {
      definition: v2,
      confirmDroppedOverrides: false,
    });

    expect(formRepository.findActiveWithLatestVersion).toHaveBeenCalledWith(
      db,
      ORG_ID,
      FORM_ID,
      { lock: true },
    );
    expect(formRepository.insertVersion).toHaveBeenCalledWith(db, {
      formId: FORM_ID,
      version: 2,
      definition: v2,
    });
    expect(taskOccurrenceService.reconcileTemplateIds).toHaveBeenCalledWith(
      db,
      {
        templateIds: [TEMPLATE_ID],
        timeZone: TIME_ZONE,
      },
    );
  });

  it("does not publish an unchanged definition, even with keys in another order", async () => {
    const reordered = JSON.parse(
      JSON.stringify({
        correctiveAction: v1.correctiveAction,
        fields: v1.fields,
      }),
    ) as FormDefinition;

    const result = await formService.createVersion(
      db,
      ORG_ID,
      TIME_ZONE,
      FORM_ID,
      {
        definition: reordered,
        confirmDroppedOverrides: false,
      },
    );

    expect(result.latestVersion.version).toBe(1);
    expect(formRepository.insertVersion).not.toHaveBeenCalled();
    expect(taskOccurrenceService.reconcileTemplateIds).not.toHaveBeenCalled();
  });

  it("keeps overrides whose measurement field survives", async () => {
    formRepository.findTemplateOverridesByForm.mockResolvedValue([overrideRow]);
    const relabelled: FormDefinition = {
      ...v1,
      fields: [{ ...temperature, label: "Air temperature" } as FormField],
    };

    await formService.createVersion(db, ORG_ID, TIME_ZONE, FORM_ID, {
      definition: relabelled,
      confirmDroppedOverrides: false,
    });

    expect(formRepository.setLimitOverrides).not.toHaveBeenCalled();
    expect(formRepository.insertVersion).toHaveBeenCalled();
  });

  it("refuses, listing each override it would drop, until confirmed", async () => {
    formRepository.findTemplateOverridesByForm.mockResolvedValue([overrideRow]);
    const withoutTemperature: FormDefinition = { ...v1, fields: [doorClosed] };

    const error = await formService
      .createVersion(db, ORG_ID, TIME_ZONE, FORM_ID, {
        definition: withoutTemperature,
        confirmDroppedOverrides: false,
      })
      .catch((e) => e);

    expect(error).toBeInstanceOf(ConflictError);
    expect(error.code).toBe(API_ERROR_CODE.FORM_VERSION_DROPS_OVERRIDES);
    expect(error.details).toEqual({
      droppedOverrides: [
        {
          templateId: TEMPLATE_ID,
          locationId: LOCATION_ID,
          locationName: "Main kitchen",
          targetId: TARGET_ID,
          targetName: "Fish fridge",
          fieldId: "temperature",
          fieldLabel: "Temperature",
          limits: { min: 0, max: 2 },
        },
      ],
    });
    expect(formRepository.insertVersion).not.toHaveBeenCalled();
    expect(formRepository.setLimitOverrides).not.toHaveBeenCalled();
  });

  it("removes the dropped overrides and publishes once confirmed", async () => {
    formRepository.findTemplateOverridesByForm.mockResolvedValue([
      {
        ...overrideRow,
        limitOverrides: {
          temperature: { min: 0, max: 2 },
          core: { min: 75, max: null },
        },
      },
    ]);
    const core = {
      ...temperature,
      id: "core",
      limits: { min: 70, max: null },
    } as FormField;
    const next: FormDefinition = { ...v1, fields: [core] };

    await formService.createVersion(db, ORG_ID, TIME_ZONE, FORM_ID, {
      definition: next,
      confirmDroppedOverrides: true,
    });

    expect(formRepository.setLimitOverrides).toHaveBeenCalledWith(
      db,
      TEMPLATE_ID,
      TARGET_ID,
      { core: { min: 75, max: null } },
    );
    expect(formRepository.insertVersion).toHaveBeenCalledWith(db, {
      formId: FORM_ID,
      version: 2,
      definition: next,
    });
  });

  it("drops an override whose field changed unit", async () => {
    formRepository.findTemplateOverridesByForm.mockResolvedValue([overrideRow]);
    const ph = {
      ...temperature,
      unit: "ph",
      limits: { min: null, max: 4.6 },
    } as FormField;

    const error = await formService
      .createVersion(db, ORG_ID, TIME_ZONE, FORM_ID, {
        definition: { ...v1, fields: [ph] },
        confirmDroppedOverrides: false,
      })
      .catch((e) => e);

    expect(error.code).toBe(API_ERROR_CODE.FORM_VERSION_DROPS_OVERRIDES);
  });

  it("is not found for an archived or foreign form", async () => {
    formRepository.findActiveWithLatestVersion.mockResolvedValue(null);

    await expect(
      formService.createVersion(db, ORG_ID, TIME_ZONE, FORM_ID, {
        definition: v1,
        confirmDroppedOverrides: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("formService.delete", () => {
  it("refuses while active templates use the form", async () => {
    formRepository.archiveIfUnused.mockResolvedValue("in_use");

    await expect(formService.delete(db, ORG_ID, FORM_ID)).rejects.toMatchObject(
      {
        code: API_ERROR_CODE.FORM_IN_USE,
      },
    );
  });

  it("is not found when there is no active form", async () => {
    formRepository.archiveIfUnused.mockResolvedValue("not_found");

    await expect(
      formService.delete(db, ORG_ID, FORM_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
