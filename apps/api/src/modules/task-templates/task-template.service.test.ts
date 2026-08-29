import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../core/errors/app-errors.js";

const equipmentRepository = vi.hoisted(() => ({
  findByIdAndLocation: vi.fn(),
}));
const taskTemplateRepository = vi.hoisted(() => ({
  insert: vi.fn(),
  updateByIdAndLocation: vi.fn(),
  archiveByIdAndLocation: vi.fn(),
}));
const taskOccurrenceService = vi.hoisted(() => ({
  reconcileTemplate: vi.fn(),
}));

vi.mock("../equipment/equipment.repository.js", () => ({ equipmentRepository }));
vi.mock("./task-template.repository.js", () => ({ taskTemplateRepository }));
vi.mock("../task-occurrences/task-occurrence.service.js", () => ({
  taskOccurrenceService,
}));

const { taskTemplateService } = await import("./task-template.service.js");

const LOCATION_ID = "00000000-0000-4000-8000-0000000000l1";
const EQUIPMENT_ID = "00000000-0000-4000-8000-0000000000e1";
const TEMPLATE_ID = "00000000-0000-4000-8000-0000000000t1";

const templateRow = {
  id: TEMPLATE_ID,
  locationId: LOCATION_ID,
  title: "Morning check",
  type: "temperature",
  weekdays: ["monday"],
  scheduledTimes: ["08:00"],
  equipmentId: EQUIPMENT_ID,
  completionOpensBeforeMinutes: 1440,
  completionDueAfterMinutes: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// `tx` inside the service is this same object, so existing `toHaveBeenCalledWith(db, ...)`
// assertions still hold — the fake transaction is transparent to callers.
const dbHandle: { transaction: (fn: (tx: unknown) => unknown) => unknown } = {
  transaction: (fn) => fn(dbHandle),
};
const db = dbHandle as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("taskTemplateService.create", () => {
  it("rejects equipment that does not belong to the template's location, without inserting", async () => {
    equipmentRepository.findByIdAndLocation.mockResolvedValue(null);

    await expect(
      taskTemplateService.create(db, LOCATION_ID, {
        title: "Morning check",
        type: "temperature",
        weekdays: ["monday"],
        scheduledTimes: ["08:00"],
        equipmentId: EQUIPMENT_ID,
        completionOpensBeforeMinutes: 1440,
        completionDueAfterMinutes: 0,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(equipmentRepository.findByIdAndLocation).toHaveBeenCalledWith(
      db,
      LOCATION_ID,
      EQUIPMENT_ID,
    );
    expect(taskTemplateRepository.insert).not.toHaveBeenCalled();
  });

  it("inserts once the equipment is confirmed to belong to the location", async () => {
    equipmentRepository.findByIdAndLocation.mockResolvedValue({ id: EQUIPMENT_ID });
    taskTemplateRepository.insert.mockResolvedValue(templateRow);

    const result = await taskTemplateService.create(db, LOCATION_ID, {
      title: "Morning check",
      type: "temperature",
      weekdays: ["monday"],
      scheduledTimes: ["08:00"],
      equipmentId: EQUIPMENT_ID,
      completionOpensBeforeMinutes: 1440,
      completionDueAfterMinutes: 0,
    });

    expect(taskTemplateRepository.insert).toHaveBeenCalledTimes(1);
    expect(taskTemplateRepository.insert).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        completionOpensBeforeMinutes: 1440,
        completionDueAfterMinutes: 0,
      }),
    );
    expect(result.id).toBe(TEMPLATE_ID);
  });

  it("skips the ownership check entirely for a cleaning template with no equipment", async () => {
    taskTemplateRepository.insert.mockResolvedValue({
      ...templateRow,
      type: "cleaning",
      equipmentId: null,
    });

    await taskTemplateService.create(db, LOCATION_ID, {
      title: "Wipe counters",
      type: "cleaning",
      weekdays: ["monday"],
      scheduledTimes: ["09:00"],
      completionOpensBeforeMinutes: 1440,
      completionDueAfterMinutes: 0,
    });

    expect(equipmentRepository.findByIdAndLocation).not.toHaveBeenCalled();
    expect(taskTemplateRepository.insert).toHaveBeenCalledTimes(1);
  });
});

describe("taskTemplateService.update", () => {
  it("rejects equipment that does not belong to the template's location, without updating", async () => {
    equipmentRepository.findByIdAndLocation.mockResolvedValue(null);

    await expect(
      taskTemplateService.update(db, LOCATION_ID, TEMPLATE_ID, {
        title: "Morning check",
        type: "temperature",
        weekdays: ["monday"],
        scheduledTimes: ["08:00"],
        equipmentId: EQUIPMENT_ID,
        completionOpensBeforeMinutes: 1440,
        completionDueAfterMinutes: 0,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(equipmentRepository.findByIdAndLocation).toHaveBeenCalledWith(
      db,
      LOCATION_ID,
      EQUIPMENT_ID,
    );
    expect(taskTemplateRepository.updateByIdAndLocation).not.toHaveBeenCalled();
  });

  it("updates once the equipment is confirmed to belong to the location", async () => {
    equipmentRepository.findByIdAndLocation.mockResolvedValue({ id: EQUIPMENT_ID });
    taskTemplateRepository.updateByIdAndLocation.mockResolvedValue(templateRow);

    const result = await taskTemplateService.update(db, LOCATION_ID, TEMPLATE_ID, {
      title: "Morning check",
      type: "temperature",
      weekdays: ["monday"],
      scheduledTimes: ["08:00"],
      equipmentId: EQUIPMENT_ID,
      completionOpensBeforeMinutes: 1440,
      completionDueAfterMinutes: 0,
    });

    expect(taskTemplateRepository.updateByIdAndLocation).toHaveBeenCalledTimes(1);
    expect(taskTemplateRepository.updateByIdAndLocation).toHaveBeenCalledWith(
      db,
      LOCATION_ID,
      TEMPLATE_ID,
      expect.objectContaining({
        completionOpensBeforeMinutes: 1440,
        completionDueAfterMinutes: 0,
      }),
    );
    expect(result.id).toBe(TEMPLATE_ID);
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
