import { API_ERROR_CODE } from "@haccp/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";

const targetRepository = vi.hoisted(() => ({
  findManyActiveByLocation: vi.fn(),
  findActiveById: vi.fn(),
  findActiveHierarchyByLocation: vi.fn(),
  hasActiveChildren: vi.fn(),
  insert: vi.fn(),
  updateActive: vi.fn(),
  archive: vi.fn(),
  findActiveTemplateIdsByTargets: vi.fn(),
  deleteTemplateLinks: vi.fn(),
}));
const taskOccurrenceService = vi.hoisted(() => ({
  reconcileTemplatesAtLocation: vi.fn(),
}));

vi.mock("./target.repository.js", () => ({ targetRepository }));
vi.mock("../task-occurrences/task-occurrence.service.js", () => ({
  taskOccurrenceService,
}));

const { targetService } = await import("./target.service.js");

const LOCATION_ID = "00000000-0000-4000-8000-0000000000a1";
const KITCHEN_ID = "00000000-0000-4000-8000-0000000000c1";
const COLD_ROOM_ID = "00000000-0000-4000-8000-0000000000c2";
const FRIDGE_ID = "00000000-0000-4000-8000-0000000000c3";
const WALLS_ID = "00000000-0000-4000-8000-0000000000c5";

const dbHandle: { transaction: (fn: (tx: unknown) => unknown) => unknown } = {
  transaction: (fn) => fn(dbHandle),
};
const db = dbHandle as never;

function targetRow(
  id: string,
  name: string,
  kind: "equipment" | "area" | "component",
  parentId: string | null = null,
) {
  return {
    target: {
      id,
      locationId: LOCATION_ID,
      kind,
      name,
      parentId,
      limits: {},
      archivedAt: null,
      createdAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: new Date("2026-10-01T00:00:00Z"),
    },
    taskCount: 2,
  };
}

// Kitchen (area) ⟵ Cold room (area) ⟵ Fish fridge (equipment); Kitchen ⟵ Walls (component)
const hierarchy = [
  { id: KITCHEN_ID, parentId: null, kind: "area", name: "Kitchen" },
  { id: COLD_ROOM_ID, parentId: KITCHEN_ID, kind: "area", name: "Cold room" },
  { id: FRIDGE_ID, parentId: COLD_ROOM_ID, kind: "equipment", name: "Fish fridge" },
  { id: WALLS_ID, parentId: KITCHEN_ID, kind: "component", name: "Walls" },
];

beforeEach(() => {
  vi.clearAllMocks();
  targetRepository.findActiveHierarchyByLocation.mockResolvedValue(hierarchy);
  targetRepository.findActiveTemplateIdsByTargets.mockResolvedValue([]);
});

describe("targetService.create", () => {
  it("rejects a parent that is not an active target here", async () => {
    await expect(
      targetService.create(db, LOCATION_ID, {
        name: "Freezer room",
        kind: "area",
        parentId: "00000000-0000-4000-8000-0000000000ff",
        limits: {},
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("refuses to place anything inside equipment", async () => {
    await expect(
      targetService.create(db, LOCATION_ID, {
        name: "Top shelf",
        kind: "equipment",
        parentId: FRIDGE_ID,
        limits: {},
      }),
    ).rejects.toMatchObject({ code: API_ERROR_CODE.TARGET_PARENT_NOT_AREA });
    expect(targetRepository.insert).not.toHaveBeenCalled();
  });

  it("refuses to place a component in equipment, or anything in a component", async () => {
    await expect(
      targetService.create(db, LOCATION_ID, {
        name: "Door",
        kind: "component",
        parentId: FRIDGE_ID,
        limits: {},
      }),
    ).rejects.toMatchObject({ code: API_ERROR_CODE.TARGET_PARENT_NOT_AREA });
    await expect(
      targetService.create(db, LOCATION_ID, {
        name: "Tile row",
        kind: "component",
        parentId: WALLS_ID,
        limits: {},
      }),
    ).rejects.toMatchObject({ code: API_ERROR_CODE.TARGET_PARENT_NOT_AREA });
    expect(targetRepository.insert).not.toHaveBeenCalled();
  });

  it("creates a component inside an area", async () => {
    const created = targetRow(
      "00000000-0000-4000-8000-0000000000c6",
      "Ceiling",
      "component",
      KITCHEN_ID,
    );
    targetRepository.insert.mockResolvedValue(created.target);
    targetRepository.findActiveById.mockResolvedValue(created);

    const result = await targetService.create(db, LOCATION_ID, {
      name: "Ceiling",
      kind: "component",
      parentId: KITCHEN_ID,
      limits: {},
    });

    expect(result).toMatchObject({ kind: "component", parentId: KITCHEN_ID });
  });

  it("creates equipment inside an area and returns its task count", async () => {
    const created = targetRow(
      "00000000-0000-4000-8000-0000000000c4",
      "Dairy fridge",
      "equipment",
      COLD_ROOM_ID,
    );
    targetRepository.insert.mockResolvedValue(created.target);
    targetRepository.findActiveById.mockResolvedValue(created);

    const result = await targetService.create(db, LOCATION_ID, {
      name: "Dairy fridge",
      kind: "equipment",
      parentId: COLD_ROOM_ID,
      limits: {},
    });

    expect(targetRepository.insert).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ kind: "equipment", parentId: COLD_ROOM_ID }),
    );
    expect(result).toMatchObject({
      name: "Dairy fridge",
      parentId: COLD_ROOM_ID,
      limits: {},
      kind: "equipment",
      taskCount: 2,
    });
  });

  it("maps a duplicate active name to TARGET_NAME_EXISTS", async () => {
    targetRepository.insert.mockRejectedValue({ code: "23505" });

    await expect(
      targetService.create(db, LOCATION_ID, {
        name: "Kitchen",
        kind: "area",
        parentId: null,
        limits: {},
      }),
    ).rejects.toMatchObject({ code: API_ERROR_CODE.TARGET_NAME_EXISTS });
  });
});

describe("targetService.update", () => {
  it("refuses to make a target its own parent", async () => {
    await expect(
      targetService.update(db, LOCATION_ID, COLD_ROOM_ID, {
        name: "Cold room",
        kind: "area",
        parentId: COLD_ROOM_ID,
        limits: {},
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to nest an area inside its own descendant", async () => {
    await expect(
      targetService.update(db, LOCATION_ID, KITCHEN_ID, {
        name: "Kitchen",
        kind: "area",
        parentId: COLD_ROOM_ID,
        limits: {},
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(targetRepository.updateActive).not.toHaveBeenCalled();
  });

  it("refuses to turn an area with items inside into equipment", async () => {
    await expect(
      targetService.update(db, LOCATION_ID, COLD_ROOM_ID, {
        name: "Cold room",
        kind: "equipment",
        parentId: KITCHEN_ID,
        limits: {},
      }),
    ).rejects.toMatchObject({ code: API_ERROR_CODE.TARGET_KIND_IN_USE });
    expect(targetRepository.updateActive).not.toHaveBeenCalled();
  });

  it("lets tasks keep checking an item whose kind changes", async () => {
    targetRepository.findActiveTemplateIdsByTargets.mockResolvedValue(["t1"]);
    targetRepository.updateActive.mockResolvedValue({ id: FRIDGE_ID });
    targetRepository.findActiveById.mockResolvedValue(
      targetRow(FRIDGE_ID, "Fish fridge", "area", COLD_ROOM_ID),
    );

    const result = await targetService.update(db, LOCATION_ID, FRIDGE_ID, {
      name: "Fish fridge",
      kind: "area",
      parentId: COLD_ROOM_ID,
      limits: {},
    });

    expect(result.kind).toBe("area");
    expect(
      taskOccurrenceService.reconcileTemplatesAtLocation,
    ).toHaveBeenCalledWith(db, LOCATION_ID, ["t1"]);
  });

  it("stores an item's own range and rebuilds the checks that judge against it", async () => {
    targetRepository.updateActive.mockResolvedValue({ id: FRIDGE_ID });
    targetRepository.findActiveTemplateIdsByTargets.mockResolvedValue(["t1"]);
    targetRepository.findActiveById.mockResolvedValue(
      targetRow(FRIDGE_ID, "Fish fridge", "equipment", COLD_ROOM_ID),
    );
    const limits = { temperature: { min: null, max: 2 } };

    await targetService.update(db, LOCATION_ID, FRIDGE_ID, {
      name: "Fish fridge",
      kind: "equipment",
      parentId: COLD_ROOM_ID,
      limits,
    });

    expect(targetRepository.updateActive).toHaveBeenCalledWith(
      db,
      LOCATION_ID,
      FRIDGE_ID,
      expect.objectContaining({ limits }),
    );
    expect(
      taskOccurrenceService.reconcileTemplatesAtLocation,
    ).toHaveBeenCalledWith(db, LOCATION_ID, ["t1"]);
  });

  it("rebuilds upcoming occurrences of templates that check it", async () => {
    targetRepository.updateActive.mockResolvedValue({ id: FRIDGE_ID });
    targetRepository.findActiveTemplateIdsByTargets.mockResolvedValue([
      "t1",
      "t2",
    ]);
    targetRepository.findActiveById.mockResolvedValue(
      targetRow(FRIDGE_ID, "Dairy fridge", "equipment", KITCHEN_ID),
    );

    const result = await targetService.update(db, LOCATION_ID, FRIDGE_ID, {
      name: "Dairy fridge",
      kind: "equipment",
      parentId: KITCHEN_ID,
      limits: {},
    });

    expect(result.name).toBe("Dairy fridge");
    expect(
      taskOccurrenceService.reconcileTemplatesAtLocation,
    ).toHaveBeenCalledWith(db, LOCATION_ID, ["t1", "t2"]);
  });

  it("renaming an area also rebuilds occurrences of tasks that check its components", async () => {
    targetRepository.updateActive.mockResolvedValue({ id: KITCHEN_ID });
    targetRepository.findActiveTemplateIdsByTargets.mockResolvedValue([
      "t1",
      "t3",
    ]);
    targetRepository.findActiveById.mockResolvedValue(
      targetRow(KITCHEN_ID, "Main kitchen", "area"),
    );

    await targetService.update(db, LOCATION_ID, KITCHEN_ID, {
      name: "Main kitchen",
      kind: "area",
      parentId: null,
      limits: {},
    });

    expect(
      targetRepository.findActiveTemplateIdsByTargets,
    ).toHaveBeenCalledWith(db, [KITCHEN_ID, WALLS_ID]);
    expect(
      taskOccurrenceService.reconcileTemplatesAtLocation,
    ).toHaveBeenCalledWith(db, LOCATION_ID, ["t1", "t3"]);
  });

  it("leaves component tasks alone when the area keeps its name", async () => {
    targetRepository.updateActive.mockResolvedValue({ id: KITCHEN_ID });
    targetRepository.findActiveById.mockResolvedValue(
      targetRow(KITCHEN_ID, "Kitchen", "area"),
    );

    await targetService.update(db, LOCATION_ID, KITCHEN_ID, {
      name: "Kitchen",
      kind: "area",
      parentId: null,
      limits: {},
    });

    expect(
      targetRepository.findActiveTemplateIdsByTargets,
    ).toHaveBeenCalledWith(db, [KITCHEN_ID]);
  });

  it("is not found for an archived or foreign target", async () => {
    await expect(
      targetService.update(
        db,
        LOCATION_ID,
        "00000000-0000-4000-8000-0000000000ff",
        { name: "Fish fridge", kind: "equipment", parentId: null, limits: {} },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(targetRepository.updateActive).not.toHaveBeenCalled();
  });
});

describe("targetService.delete", () => {
  it("archives, unlinks it from templates and rebuilds their occurrences", async () => {
    targetRepository.archive.mockResolvedValue({ id: FRIDGE_ID });
    targetRepository.hasActiveChildren.mockResolvedValue(false);
    targetRepository.deleteTemplateLinks.mockResolvedValue(["t1"]);

    await targetService.delete(db, LOCATION_ID, FRIDGE_ID);

    expect(targetRepository.deleteTemplateLinks).toHaveBeenCalledWith(
      db,
      FRIDGE_ID,
    );
    expect(
      taskOccurrenceService.reconcileTemplatesAtLocation,
    ).toHaveBeenCalledWith(db, LOCATION_ID, ["t1"]);
  });

  it("refuses while active targets sit inside it", async () => {
    targetRepository.archive.mockResolvedValue({ id: KITCHEN_ID });
    targetRepository.hasActiveChildren.mockResolvedValue(true);

    await expect(
      targetService.delete(db, LOCATION_ID, KITCHEN_ID),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(targetRepository.deleteTemplateLinks).not.toHaveBeenCalled();
  });

  it("is not found for an archived or foreign target", async () => {
    targetRepository.archive.mockResolvedValue(null);

    await expect(
      targetService.delete(db, LOCATION_ID, FRIDGE_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(targetRepository.hasActiveChildren).not.toHaveBeenCalled();
  });
});
