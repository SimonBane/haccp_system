import { and, asc, eq } from "drizzle-orm";
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
  async findManyWithEquipmentByOrgAndLocation(
    db: Db,
    orgId: string,
    locationId: string,
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
          eq(taskTemplates.orgId, orgId),
          eq(taskTemplates.locationId, locationId),
        ),
      )
      .orderBy(asc(taskTemplates.title));
  },

  async findWithEquipmentById(
    db: Db,
    orgId: string,
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
          eq(taskTemplates.orgId, orgId),
          eq(taskTemplates.locationId, locationId),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async findByIdAndOrg(db: Db, orgId: string, taskTemplateId: string) {
    const [row] = await db
      .select()
      .from(taskTemplates)
      .where(
        and(
          eq(taskTemplates.id, taskTemplateId),
          eq(taskTemplates.orgId, orgId),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  async insert(db: Db, data: typeof taskTemplates.$inferInsert) {
    const [created] = await db.insert(taskTemplates).values(data).returning();
    return created ?? null;
  },

  async updateByIdAndOrg(
    db: Db,
    orgId: string,
    taskTemplateId: string,
    updates: Partial<typeof taskTemplates.$inferInsert>,
  ) {
    const [updated] = await db
      .update(taskTemplates)
      .set(updates)
      .where(
        and(
          eq(taskTemplates.id, taskTemplateId),
          eq(taskTemplates.orgId, orgId),
        ),
      )
      .returning();

    return updated ?? null;
  },

  async deleteByIdAndOrg(db: Db, orgId: string, taskTemplateId: string) {
    const [deleted] = await db
      .delete(taskTemplates)
      .where(
        and(
          eq(taskTemplates.id, taskTemplateId),
          eq(taskTemplates.orgId, orgId),
        ),
      )
      .returning({ id: taskTemplates.id });

    return deleted ?? null;
  },

  async findEquipmentNameById(db: Db, equipmentId: string) {
    const [row] = await db
      .select({ name: equipment.name })
      .from(equipment)
      .where(eq(equipment.id, equipmentId))
      .limit(1);

    return row?.name ?? null;
  },
};
