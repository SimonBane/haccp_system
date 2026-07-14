import type {
  CreateEquipmentInput,
  EquipmentListResponse,
  EquipmentResponse,
  UpdateEquipmentInput,
} from "@haccp/shared";
import { and, asc, eq, ne } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { equipment } from "../db/schema/equipment.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { locationService } from "./location.service.js";

function toEquipmentResponse(
  row: typeof equipment.$inferSelect,
): EquipmentResponse {
  return {
    id: row.id,
    orgId: row.orgId,
    locationId: row.locationId,
    name: row.name,
    type: row.type as EquipmentResponse["type"],
    minTempC: Number(row.minTempC),
    maxTempC: Number(row.maxTempC),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  ) {
    return true;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    isUniqueViolation((error as { cause: unknown }).cause)
  ) {
    return true;
  }

  return false;
}

async function assertNameAvailable(
  db: Db,
  locationId: string,
  name: string,
  excludeEquipmentId?: string,
): Promise<void> {
  const existing = await db.query.equipment.findFirst({
    where: and(
      eq(equipment.locationId, locationId),
      eq(equipment.name, name),
      excludeEquipmentId
        ? ne(equipment.id, excludeEquipmentId)
        : undefined,
    ),
  });

  if (existing) {
    throw new ConflictError(
      "Equipment with this name already exists at this site",
    );
  }
}

export const equipmentService = {
  async list(db: Db, orgId: string): Promise<EquipmentListResponse> {
    const rows = await db.query.equipment.findMany({
      where: eq(equipment.orgId, orgId),
      orderBy: [asc(equipment.name)],
    });

    return {
      items: rows.map(toEquipmentResponse),
    };
  },

  async create(
    db: Db,
    orgId: string,
    input: CreateEquipmentInput,
  ): Promise<EquipmentResponse> {
    const location = await locationService.getOrCreateCurrentLocation(db, orgId);

    await assertNameAvailable(db, location.id, input.name);

    try {
      const [created] = await db
        .insert(equipment)
        .values({
          orgId,
          locationId: location.id,
          name: input.name,
          type: input.type,
          minTempC: String(input.minTempC),
          maxTempC: String(input.maxTempC),
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create equipment");
      }

      return toEquipmentResponse(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          "Equipment with this name already exists at this site",
        );
      }

      throw error;
    }
  },

  async update(
    db: Db,
    orgId: string,
    equipmentId: string,
    input: UpdateEquipmentInput,
  ): Promise<EquipmentResponse> {
    const existing = await db.query.equipment.findFirst({
      where: and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)),
    });

    if (!existing) {
      throw new NotFoundError("Equipment not found");
    }

    const updates: Partial<typeof equipment.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.type !== undefined) updates.type = input.type;
    if (input.minTempC !== undefined) updates.minTempC = String(input.minTempC);
    if (input.maxTempC !== undefined) updates.maxTempC = String(input.maxTempC);

    if (input.name !== undefined && input.name !== existing.name) {
      await assertNameAvailable(
        db,
        existing.locationId,
        input.name,
        equipmentId,
      );
    }

    try {
      const [updated] = await db
        .update(equipment)
        .set(updates)
        .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
        .returning();

      if (!updated) {
        throw new NotFoundError("Equipment not found");
      }

      return toEquipmentResponse(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          "Equipment with this name already exists at this site",
        );
      }

      throw error;
    }
  },

  async delete(db: Db, orgId: string, equipmentId: string): Promise<void> {
    const existing = await db.query.equipment.findFirst({
      where: and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)),
    });

    if (!existing) {
      throw new NotFoundError("Equipment not found");
    }

    await db
      .delete(equipment)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)));
  },
};
