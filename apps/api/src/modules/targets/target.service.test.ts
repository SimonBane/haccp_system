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
  findActiveTypeForLocation: vi.fn(),
  hasActiveChildren: vi.fn(),
  insert: vi.fn(),
  updateActive: vi.fn(),
  archive: vi.fn(),
  findActiveTemplateIdsByTarget: vi.fn(),
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
const TYPE_ID = "00000000-0000-4000-8000-0000000000b1";
const KITCHEN_ID = "00000000-0000-4000-8000-0000000000c1";
const FRIDGE_ID = "00000000-0000-4000-8000-0000000000c2";
const SHELF_ID = "00000000-0000-4000-8000-0000000000c3";

const dbHandle: { transaction: (fn: (tx: unknown) => unknown) => unknown } = {
  transaction: (fn) => fn(dbHandle),
};
const db = dbHandle as never;

function targetRow(id: string, name: string, parentId: string | null = null) {
  return {
    target: {
      id,
      locationId: LOCATION_ID,
      targetTypeId: TYPE_ID,
      name,
      parentId,
      archivedAt: null,
      createdAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: new Date("2026-10-01T00:00:00Z"),
    },
    targetTypeName: "Fridge",
    kind: "equipment",
  };
}

// Kitchen ⟵ Fridge ⟵ Shelf
const tree = [
  targetRow(KITCHEN_ID, "Kitchen"),
  targetRow(FRIDGE_ID, "Fish fridge", KITCHEN_ID),
  targetRow(SHELF_ID, "Top shelf", FRIDGE_ID),
];

beforeEach(() => {
  vi.clearAllMocks();
  targetRepository.findActiveTypeForLocation.mockResolvedValue({ id: TYPE_ID });
  targetRepository.findManyActiveByLocation.mockResolvedValue(tree);
  targetRepository.findActiveTemplateIdsByTarget.mockResolvedValue([]);
});

describe("targetService.create", () => {
  it("rejects a type that is archived or belongs to another organisation", async () => {
    targetRepository.findActiveTypeForLocation.mockResolvedValue(null);

    await expect(
      targetService.create(db, LOCATION_ID, {
        name: "Fish fridge",
        targetTypeId: TYPE_ID,
        parentId: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(targetRepository.insert).not.toHaveBeenCalled();
  });

  it("rejects a parent that is not an active target here", async () => {
    await expect(
      targetService.create(db, LOCATION_ID, {
        name: "Cold room",
        targetTypeId: TYPE_ID,
        parentId: "00000000-0000-4000-8000-0000000000ff",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates under a valid parent and returns it with its type", async () => {
    const created = targetRow(
      "00000000-0000-4000-8000-0000000000c4",
      "Bottom shelf",
      FRIDGE_ID,
    );
    targetRepository.insert.mockResolvedValue(created.target);
    targetRepository.findActiveById.mockResolvedValue(created);

    const result = await targetService.create(db, LOCATION_ID, {
      name: "Bottom shelf",
      targetTypeId: TYPE_ID,
      parentId: FRIDGE_ID,
    });

    expect(result).toMatchObject({
      name: "Bottom shelf",
      parentId: FRIDGE_ID,
      targetTypeName: "Fridge",
      kind: "equipment",
    });
  });

  it("maps a duplicate active name to TARGET_NAME_EXISTS", async () => {
    targetRepository.insert.mockRejectedValue({ code: "23505" });

    await expect(
      targetService.create(db, LOCATION_ID, {
        name: "Kitchen",
        targetTypeId: TYPE_ID,
        parentId: null,
      }),
    ).rejects.toMatchObject({ code: API_ERROR_CODE.TARGET_NAME_EXISTS });
  });
});

describe("targetService.update", () => {
  it("refuses to make a target its own parent", async () => {
    await expect(
      targetService.update(db, LOCATION_ID, FRIDGE_ID, {
        name: "Fish fridge",
        targetTypeId: TYPE_ID,
        parentId: FRIDGE_ID,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to nest a target inside its own descendant", async () => {
    await expect(
      targetService.update(db, LOCATION_ID, KITCHEN_ID, {
        name: "Kitchen",
        targetTypeId: TYPE_ID,
        parentId: SHELF_ID,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(targetRepository.updateActive).not.toHaveBeenCalled();
  });

  it("rebuilds upcoming occurrences of templates that check it", async () => {
    targetRepository.updateActive.mockResolvedValue({ id: FRIDGE_ID });
    targetRepository.findActiveTemplateIdsByTarget.mockResolvedValue([
      "t1",
      "t2",
    ]);
    targetRepository.findActiveById.mockResolvedValue(
      targetRow(FRIDGE_ID, "Dairy fridge", KITCHEN_ID),
    );

    const result = await targetService.update(db, LOCATION_ID, FRIDGE_ID, {
      name: "Dairy fridge",
      targetTypeId: TYPE_ID,
      parentId: KITCHEN_ID,
    });

    expect(result.name).toBe("Dairy fridge");
    expect(
      taskOccurrenceService.reconcileTemplatesAtLocation,
    ).toHaveBeenCalledWith(db, LOCATION_ID, ["t1", "t2"]);
  });

  it("is not found for an archived or foreign target", async () => {
    targetRepository.updateActive.mockResolvedValue(null);

    await expect(
      targetService.update(db, LOCATION_ID, FRIDGE_ID, {
        name: "Fish fridge",
        targetTypeId: TYPE_ID,
        parentId: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
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
