import type {
  CreateEquipmentInput,
  EquipmentListResponse,
  EquipmentResponse,
  UpdateEquipmentInput,
} from "@haccp/shared";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { equipment } from "../db/schema/equipment.js";
import { ConflictError, NotFoundError } from "../lib/errors.js";

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

function isPostgresError(error: unknown, code: string): boolean {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  ) {
    return true;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    isPostgresError((error as { cause: unknown }).cause, code)
  ) {
    return true;
  }

  return false;
}

function isUniqueViolation(error: unknown): boolean {
  return isPostgresError(error, "23505");
}

function isForeignKeyViolation(error: unknown): boolean {
  return isPostgresError(error, "23503");
}

function mapEquipmentMutationError(error: unknown): never {
  if (isUniqueViolation(error)) {
    throw new ConflictError(
      "Equipment with this name already exists at this site",
    );
  }

  if (isForeignKeyViolation(error)) {
    throw new NotFoundError("Location not found");
  }

  throw error;
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
    try {
      const [created] = await db
        .insert(equipment)
        .values({
          orgId,
          locationId: input.locationId,
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
      mapEquipmentMutationError(error);
    }
  },

  async update(
    db: Db,
    orgId: string,
    equipmentId: string,
    input: UpdateEquipmentInput,
  ): Promise<EquipmentResponse> {
    const updates: Partial<typeof equipment.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.type !== undefined) updates.type = input.type;
    if (input.minTempC !== undefined) updates.minTempC = String(input.minTempC);
    if (input.maxTempC !== undefined) updates.maxTempC = String(input.maxTempC);

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
      if (error instanceof NotFoundError) {
        throw error;
      }

      mapEquipmentMutationError(error);
    }
  },

  async delete(db: Db, orgId: string, equipmentId: string): Promise<void> {
    const [deleted] = await db
      .delete(equipment)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
      .returning({ id: equipment.id });

    if (!deleted) {
      throw new NotFoundError("Equipment not found");
    }
  },
};
