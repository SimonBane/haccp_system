import { inArray } from "drizzle-orm";
import type { DbClient } from "../../core/db/client.js";
import { taskOccurrences } from "../../core/db/schema/task-occurrences.js";
import { taskRecords } from "../../core/db/schema/task-records.js";

export type TaskOccurrenceRow = typeof taskOccurrences.$inferSelect;
export type NewTaskOccurrenceRow = typeof taskOccurrences.$inferInsert;

export const taskOccurrenceRepository = {
  async findByTemplateIds(
    db: DbClient,
    templateIds: string[],
  ): Promise<TaskOccurrenceRow[]> {
    if (templateIds.length === 0) return [];

    return db
      .select()
      .from(taskOccurrences)
      .where(inArray(taskOccurrences.taskTemplateId, templateIds));
  },

  async findRecordedOccurrenceIds(
    db: DbClient,
    occurrenceIds: string[],
  ): Promise<Set<string>> {
    if (occurrenceIds.length === 0) return new Set();

    const rows = await db
      .select({ occurrenceId: taskRecords.occurrenceId })
      .from(taskRecords)
      .where(inArray(taskRecords.occurrenceId, occurrenceIds));

    return new Set(rows.map((row) => row.occurrenceId));
  },

  async insertMany(
    db: DbClient,
    rows: NewTaskOccurrenceRow[],
  ): Promise<{ id: string }[]> {
    if (rows.length === 0) return [];

    return db
      .insert(taskOccurrences)
      .values(rows)
      .onConflictDoNothing()
      .returning({ id: taskOccurrences.id });
  },

  async deleteByIds(db: DbClient, ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await db.delete(taskOccurrences).where(inArray(taskOccurrences.id, ids));
  },
};
