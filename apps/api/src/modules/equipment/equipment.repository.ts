import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../core/db/client.js";
import { equipment } from "../../core/db/schema/equipment.js";

export const equipmentRepository = {
  async findByIdAndLocation(db: Db, locationId: string, equipmentId: string) {
    const [row] = await db
      .select({ id: equipment.id })
      .from(equipment)
      .where(
        and(eq(equipment.id, equipmentId), eq(equipment.locationId, locationId)),
      )
      .limit(1);

    return row ?? null;
  },

  async findManyByLocation(db: Db, locationId: string) {
    return db
      .select()
      .from(equipment)
      .where(eq(equipment.locationId, locationId))
      .orderBy(asc(equipment.name));
  },

  async insert(db: Db, data: typeof equipment.$inferInsert) {
    const [created] = await db.insert(equipment).values(data).returning();
    return created ?? null;
  },

  async updateByIdAndLocation(
    db: Db,
    locationId: string,
    equipmentId: string,
    updates: Partial<typeof equipment.$inferInsert>,
  ) {
    const [updated] = await db
      .update(equipment)
      .set(updates)
      .where(
        and(eq(equipment.id, equipmentId), eq(equipment.locationId, locationId)),
      )
      .returning();

    return updated ?? null;
  },

  async deleteByIdAndLocation(
    db: Db,
    locationId: string,
    equipmentId: string,
  ) {
    const [deleted] = await db
      .delete(equipment)
      .where(
        and(eq(equipment.id, equipmentId), eq(equipment.locationId, locationId)),
      )
      .returning({ id: equipment.id });

    return deleted ?? null;
  },

};
