import { API_ERROR_CODE } from "@haccp/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError } from "../../core/errors/app-errors.js";

const targetTypeRepository = vi.hoisted(() => ({
  findManyActiveByOrganization: vi.fn(),
  insert: vi.fn(),
  updateActive: vi.fn(),
  archiveIfUnused: vi.fn(),
}));

vi.mock("./target-type.repository.js", () => ({ targetTypeRepository }));

const { targetTypeService } = await import("./target-type.service.js");

const ORG_ID = "00000000-0000-4000-8000-0000000000a1";
const TYPE_ID = "00000000-0000-4000-8000-0000000000b1";
const db = {} as never;

const row = {
  id: TYPE_ID,
  organizationId: ORG_ID,
  name: "Fridge",
  kind: "equipment",
  archivedAt: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("targetTypeService.create", () => {
  it("creates a type scoped to the organisation", async () => {
    targetTypeRepository.insert.mockResolvedValue(row);

    const created = await targetTypeService.create(db, ORG_ID, {
      name: "Fridge",
      kind: "equipment",
    });

    expect(targetTypeRepository.insert).toHaveBeenCalledWith(db, {
      organizationId: ORG_ID,
      name: "Fridge",
      kind: "equipment",
    });
    expect(created).toMatchObject({
      id: TYPE_ID,
      name: "Fridge",
      kind: "equipment",
    });
  });

  it("maps a duplicate active name to TARGET_TYPE_NAME_EXISTS", async () => {
    targetTypeRepository.insert.mockRejectedValue({ code: "23505" });

    await expect(
      targetTypeService.create(db, ORG_ID, {
        name: "Fridge",
        kind: "equipment",
      }),
    ).rejects.toMatchObject({ code: API_ERROR_CODE.TARGET_TYPE_NAME_EXISTS });
  });
});

describe("targetTypeService.update", () => {
  it("is not found for an archived or foreign type", async () => {
    targetTypeRepository.updateActive.mockResolvedValue(null);

    await expect(
      targetTypeService.update(db, ORG_ID, TYPE_ID, {
        name: "Freezer",
        kind: "equipment",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("targetTypeService.delete", () => {
  it("archives an unused type", async () => {
    targetTypeRepository.archiveIfUnused.mockResolvedValue("archived");

    await expect(
      targetTypeService.delete(db, ORG_ID, TYPE_ID),
    ).resolves.toBeUndefined();
  });

  it("refuses while active targets use the type", async () => {
    targetTypeRepository.archiveIfUnused.mockResolvedValue("in_use");

    const error = await targetTypeService
      .delete(db, ORG_ID, TYPE_ID)
      .catch((e) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect(error.code).toBe(API_ERROR_CODE.TARGET_TYPE_IN_USE);
  });

  it("is not found when there is no active type", async () => {
    targetTypeRepository.archiveIfUnused.mockResolvedValue("not_found");

    await expect(
      targetTypeService.delete(db, ORG_ID, TYPE_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
