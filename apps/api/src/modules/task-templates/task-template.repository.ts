import type { TaskTemplateType } from "@haccp/shared";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db, DbClient } from "../../core/db/client.js";
import { equipment } from "../../core/db/schema/equipment.js";
import { locations } from "../../core/db/schema/locations.js";
import { taskTemplates } from "../../core/db/schema/task-templates.js";

export type TaskTemplateWithEquipmentRow = {
  template: typeof taskTemplates.$inferSelect;
  equipmentName: string | null;
  minTempC: string | null;
  maxTempC: string | null;
};

export type TaskTemplateSourceRow = {
  id: string;
  locationId: string;
  title: string;
  type: TaskTemplateType;
  weekdays: string[];
  scheduledTimes: string[];
  equipmentId: string | null;
  completionOpensBeforeMinutes: number;
  completionDueAfterMinutes: number | null;
  createdAt: Date;
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
      .leftJoin(
        equipment,
        and(
          eq(taskTemplates.equipmentId, equipment.id),
          eq(equipment.locationId, taskTemplates.locationId),
        ),
      )
      .where(
        and(
          eq(taskTemplates.locationId, locationId),
          isNull(taskTemplates.archivedAt),
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
      .leftJoin(
        equipment,
        and(
          eq(taskTemplates.equipmentId, equipment.id),
          eq(equipment.locationId, taskTemplates.locationId),
        ),
      )
      .where(
        and(
          eq(taskTemplates.locationId, locationId),
          isNull(taskTemplates.archivedAt),
        ),
      )
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
      .leftJoin(
        equipment,
        and(
          eq(taskTemplates.equipmentId, equipment.id),
          eq(equipment.locationId, taskTemplates.locationId),
        ),
      )
      .where(
        and(
          eq(taskTemplates.id, templateId),
          eq(taskTemplates.locationId, locationId),
          isNull(taskTemplates.archivedAt),
        ),
      )
      .limit(1);

    return row ?? null;
  },


  async insert(db: DbClient, data: typeof taskTemplates.$inferInsert) {
    const [created] = await db.insert(taskTemplates).values(data).returning();
    return created ?? null;
  },

  async updateByIdAndLocation(
    db: DbClient,
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

  async archiveByIdAndLocation(
    db: DbClient,
    locationId: string,
    taskTemplateId: string,
  ) {
    const now = new Date();
    const [archived] = await db
      .update(taskTemplates)
      .set({ archivedAt: now, updatedAt: now })
      .where(
        and(
          eq(taskTemplates.id, taskTemplateId),
          eq(taskTemplates.locationId, locationId),
          isNull(taskTemplates.archivedAt),
        ),
      )
      .returning({ id: taskTemplates.id });

    return archived ?? null;
  },

  async findActiveWithEquipmentByIds(
    db: DbClient,
    templateIds: string[],
  ): Promise<TaskTemplateSourceRow[]> {
    if (templateIds.length === 0) return [];

    // `type` is stored as text, not a Postgres enum; cast once at this boundary
    // so every caller works with the shared TaskTemplateType, not a bare string.
    const rows = await db
      .select({
        id: taskTemplates.id,
        locationId: taskTemplates.locationId,
        title: taskTemplates.title,
        type: taskTemplates.type,
        weekdays: taskTemplates.weekdays,
        scheduledTimes: taskTemplates.scheduledTimes,
        equipmentId: taskTemplates.equipmentId,
        completionOpensBeforeMinutes: taskTemplates.completionOpensBeforeMinutes,
        completionDueAfterMinutes: taskTemplates.completionDueAfterMinutes,
        createdAt: taskTemplates.createdAt,
        equipmentName: equipment.name,
        minTempC: equipment.minTempC,
        maxTempC: equipment.maxTempC,
      })
      .from(taskTemplates)
      .leftJoin(
        equipment,
        and(
          eq(taskTemplates.equipmentId, equipment.id),
          eq(equipment.locationId, taskTemplates.locationId),
        ),
      )
      .where(
        and(
          inArray(taskTemplates.id, templateIds),
          isNull(taskTemplates.archivedAt),
        ),
      );

    return rows as TaskTemplateSourceRow[];
  },

  async findActiveIdsByLocationAndEquipment(
    db: DbClient,
    locationId: string,
    equipmentId: string,
  ): Promise<string[]> {
    const rows = await db
      .select({ id: taskTemplates.id })
      .from(taskTemplates)
      .where(
        and(
          eq(taskTemplates.locationId, locationId),
          eq(taskTemplates.equipmentId, equipmentId),
          isNull(taskTemplates.archivedAt),
        ),
      );

    return rows.map((row) => row.id);
  },

  async findActiveIdsByOrganization(
    db: DbClient,
    organizationId: string,
  ): Promise<string[]> {
    const rows = await db
      .select({ id: taskTemplates.id })
      .from(taskTemplates)
      .innerJoin(locations, eq(taskTemplates.locationId, locations.id))
      .where(
        and(
          eq(locations.organizationId, organizationId),
          isNull(taskTemplates.archivedAt),
        ),
      );

    return rows.map((row) => row.id);
  },
};
