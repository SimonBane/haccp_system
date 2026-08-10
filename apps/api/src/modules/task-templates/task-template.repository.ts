import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../../core/db/client.js";
import { equipment } from "../../core/db/schema/equipment.js";
import { taskTemplates } from "../../core/db/schema/task-templates.js";

export type TaskTemplateWithEquipmentRow = {
  template: typeof taskTemplates.$inferSelect;
  equipmentName: string | null;
  minTempC: string | null;
  maxTempC: string | null;
};

export const taskTemplateRepository = {
  async findManyWithEquipmentByLocationAndWeekday(
    db: Db,
    locationId: string,
    weekday: string,
  ) {
    return db
      .select({
        template: taskTemplates,
        equipmentName: equipment.name,
        minTempC: equipment.minTempC,
        maxTempC: equipment.maxTempC,
      })
      .from(taskTemplates)
      .leftJoin(equipment, eq(taskTemplates.equipmentId, equipment.id))
      .where(
        and(
          eq(taskTemplates.locationId, locationId),
          sql`${weekday} = ANY(${taskTemplates.weekdays})`,
        ),
      )
      .orderBy(asc(taskTemplates.title));
  },

  async findManyWithEquipmentByLocation(db: Db, locationId: string) {
    return db
      .select({
        template: taskTemplates,
        equipmentName: equipment.name,
        minTempC: equipment.minTempC,
        maxTempC: equipment.maxTempC,
      })
      .from(taskTemplates)
      .leftJoin(equipment, eq(taskTemplates.equipmentId, equipment.id))
      .where(eq(taskTemplates.locationId, locationId))
      .orderBy(asc(taskTemplates.title));
  },

  async findWithEquipmentById(
    db: Db,
    locationId: string,
    templateId: string,
  ) {
    const [row] = await db
      .select({
        template: taskTemplates,
        equipmentName: equipment.name,
        minTempC: equipment.minTempC,
        maxTempC: equipment.maxTempC,
      })
      .from(taskTemplates)
      .leftJoin(equipment, eq(taskTemplates.equipmentId, equipment.id))
      .where(
        and(
          eq(taskTemplates.id, templateId),
          eq(taskTemplates.locationId, locationId),
        ),
      )
      .limit(1);

    return row ?? null;
  },


  async insert(db: Db, data: typeof taskTemplates.$inferInsert) {
    const [created] = await db.insert(taskTemplates).values(data).returning();
    return created ?? null;
  },

  async updateByIdAndLocation(
    db: Db,
    locationId: string,
    taskTemplateId: string,
    updates: Partial<typeof taskTemplates.$inferInsert>,
  ) {
    const [updated] = await db
      .update(taskTemplates)
      .set(updates)
      .where(
        and(
          eq(taskTemplates.id, taskTemplateId),
          eq(taskTemplates.locationId, locationId),
        ),
      )
      .returning();

    return updated ?? null;
  },

  async deleteByIdAndLocation(
    db: Db,
    locationId: string,
    taskTemplateId: string,
  ) {
    const [deleted] = await db
      .delete(taskTemplates)
      .where(
        and(
          eq(taskTemplates.id, taskTemplateId),
          eq(taskTemplates.locationId, locationId),
        ),
      )
      .returning({ id: taskTemplates.id });

    return deleted ?? null;
  },
};
