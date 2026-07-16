import type {
  CreateTaskTemplateInput,
  TaskTemplateListResponse,
  TaskTemplateResponse,
  UpdateTaskTemplateInput,
} from "@haccp/shared";
import { sortScheduledTimes, sortWeekdays } from "@haccp/shared";
import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { equipment } from "../db/schema/equipment.js";
import { taskTemplates } from "../db/schema/task-templates.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";

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

function isForeignKeyViolation(error: unknown): boolean {
  return isPostgresError(error, "23503");
}

function mapTaskTemplateMutationError(error: unknown): never {
  if (isForeignKeyViolation(error)) {
    throw new NotFoundError("Equipment or location not found");
  }

  throw error;
}

function toTaskTemplateResponse(
  row: typeof taskTemplates.$inferSelect,
  equipmentName: string | null,
): TaskTemplateResponse {
  return {
    id: row.id,
    orgId: row.orgId,
    locationId: row.locationId,
    title: row.title,
    type: row.type as TaskTemplateResponse["type"],
    weekdays: sortWeekdays(row.weekdays as TaskTemplateResponse["weekdays"]),
    scheduledTimes: sortScheduledTimes(row.scheduledTimes),
    equipmentId: row.equipmentId,
    equipmentName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function assertEquipmentForTemplate(
  db: Db,
  orgId: string,
  locationId: string,
  equipmentId: string,
): Promise<void> {
  const [matched] = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(
      and(
        eq(equipment.id, equipmentId),
        eq(equipment.orgId, orgId),
        eq(equipment.locationId, locationId),
      ),
    )
    .limit(1);

  if (!matched) {
    throw new NotFoundError("Equipment not found");
  }
}

export const taskTemplateService = {
  async list(db: Db, orgId: string): Promise<TaskTemplateListResponse> {
    const rows = await db
      .select({
        template: taskTemplates,
        equipmentName: equipment.name,
      })
      .from(taskTemplates)
      .leftJoin(equipment, eq(taskTemplates.equipmentId, equipment.id))
      .where(eq(taskTemplates.orgId, orgId))
      .orderBy(asc(taskTemplates.title));

    return {
      items: rows.map((row) =>
        toTaskTemplateResponse(row.template, row.equipmentName),
      ),
    };
  },

  async create(
    db: Db,
    orgId: string,
    input: CreateTaskTemplateInput,
  ): Promise<TaskTemplateResponse> {
    if (input.equipmentId) {
      await assertEquipmentForTemplate(
        db,
        orgId,
        input.locationId,
        input.equipmentId,
      );
    }

    try {
      const [created] = await db
        .insert(taskTemplates)
        .values({
          orgId,
          locationId: input.locationId,
          title: input.title,
          type: input.type,
          weekdays: sortWeekdays(input.weekdays),
          scheduledTimes: sortScheduledTimes(input.scheduledTimes),
          equipmentId: input.equipmentId ?? null,
        })
        .returning();

      if (!created) {
        throw new Error("Failed to create task template");
      }

      let equipmentName: string | null = null;
      if (created.equipmentId) {
        const [matched] = await db
          .select({ name: equipment.name })
          .from(equipment)
          .where(eq(equipment.id, created.equipmentId))
          .limit(1);
        equipmentName = matched?.name ?? null;
      }

      return toTaskTemplateResponse(created, equipmentName);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      mapTaskTemplateMutationError(error);
    }
  },

  async update(
    db: Db,
    orgId: string,
    taskTemplateId: string,
    input: UpdateTaskTemplateInput,
  ): Promise<TaskTemplateResponse> {
    const [existing] = await db
      .select()
      .from(taskTemplates)
      .where(
        and(eq(taskTemplates.id, taskTemplateId), eq(taskTemplates.orgId, orgId)),
      )
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Task template not found");
    }

    const nextType = input.type ?? (existing.type as TaskTemplateResponse["type"]);
    const nextEquipmentId =
      input.equipmentId !== undefined
        ? input.equipmentId
        : existing.equipmentId;

    if (nextType === "temperature" && !nextEquipmentId) {
      throw new ValidationError("Equipment is required for temperature tasks");
    }

    if (nextEquipmentId) {
      await assertEquipmentForTemplate(
        db,
        orgId,
        existing.locationId,
        nextEquipmentId,
      );
    }

    const updates: Partial<typeof taskTemplates.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) updates.title = input.title;
    if (input.type !== undefined) updates.type = input.type;
    if (input.weekdays !== undefined) {
      updates.weekdays = sortWeekdays(input.weekdays);
    }
    if (input.scheduledTimes !== undefined) {
      updates.scheduledTimes = sortScheduledTimes(input.scheduledTimes);
    }
    if (input.equipmentId !== undefined) {
      updates.equipmentId = input.equipmentId;
    } else if (input.type !== undefined && input.type !== "temperature") {
      updates.equipmentId = null;
    }

    try {
      const [updated] = await db
        .update(taskTemplates)
        .set(updates)
        .where(
          and(eq(taskTemplates.id, taskTemplateId), eq(taskTemplates.orgId, orgId)),
        )
        .returning();

      if (!updated) {
        throw new NotFoundError("Task template not found");
      }

      let equipmentName: string | null = null;
      if (updated.equipmentId) {
        const [matched] = await db
          .select({ name: equipment.name })
          .from(equipment)
          .where(eq(equipment.id, updated.equipmentId))
          .limit(1);
        equipmentName = matched?.name ?? null;
      }

      return toTaskTemplateResponse(updated, equipmentName);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      mapTaskTemplateMutationError(error);
    }
  },

  async delete(db: Db, orgId: string, taskTemplateId: string): Promise<void> {
    const [deleted] = await db
      .delete(taskTemplates)
      .where(
        and(eq(taskTemplates.id, taskTemplateId), eq(taskTemplates.orgId, orgId)),
      )
      .returning({ id: taskTemplates.id });

    if (!deleted) {
      throw new NotFoundError("Task template not found");
    }
  },
};
