import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../../core/db/client.js";
import { equipment } from "../../core/db/schema/equipment.js";

export const equipmentRepository = {
  async findManyByOrgAndLocation(
    db: Db,
    orgId: string,
    locationId: string,
  ) {
    return db
      .select({
        id: equipment.id,
        orgId: equipment.orgId,
        locationId: equipment.locationId,
        name: equipment.name,
        type: equipment.type,
        minTempC: equipment.minTempC,
        maxTempC: equipment.maxTempC,
        createdAt: equipment.createdAt,
        updatedAt: equipment.updatedAt,
      })
      .from(equipment)
      .where(
        and(eq(equipment.orgId, orgId), eq(equipment.locationId, locationId)),
      )
      .orderBy(asc(equipment.name));
  },

  async insert(db: Db, data: typeof equipment.$inferInsert) {
    const [created] = await db.insert(equipment).values(data).returning();
    return created ?? null;
  },

  async updateByIdAndOrg(
    db: Db,
    orgId: string,
    equipmentId: string,
    updates: Partial<typeof equipment.$inferInsert>,
  ) {
    const [updated] = await db
      .update(equipment)
      .set(updates)
      .where(and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)))
      .returning();

    return updated ?? null;
  },

  async deleteByIdAndOrg(db: Db, orgId: string, equipmentId: string) {
    const [deleted] = await db
      .delete(equipment)
      .where(
        and(eq(equipment.id, equipmentId), eq(equipment.orgId, orgId)),
      )
      .returning({ id: equipment.id });

    return deleted ?? null;
  },

  async findByIdAndOrgAndLocation(
    db: Db,
    orgId: string,
    locationId: string,
    equipmentId: string,
  ) {
    const [row] = await db
      .select({ id: equipment.id, name: equipment.name })
      .from(equipment)
      .where(
        and(
          eq(equipment.id, equipmentId),
          eq(equipment.orgId, orgId),
          eq(equipment.locationId, locationId),
        ),
      )
      .limit(1);

    return row ?? null;
  },
};
