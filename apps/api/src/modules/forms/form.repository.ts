import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../core/db/client.js";
import { formVersions } from "../../core/db/schema/form-versions.js";
import { forms } from "../../core/db/schema/forms.js";
import { taskTemplateTargets } from "../../core/db/schema/task-template-targets.js";
import { taskTemplates } from "../../core/db/schema/task-templates.js";

export type FormRow = typeof forms.$inferSelect;
export type FormVersionRow = typeof formVersions.$inferSelect;

export type FormWithLatestVersion = {
  form: FormRow;
  latestVersion: FormVersionRow;
};

async function findLatestVersions(
  db: DbClient,
  formIds: string[],
): Promise<Map<string, FormVersionRow>> {
  if (formIds.length === 0) return new Map();

  const rows = await db
    .selectDistinctOn([formVersions.formId])
    .from(formVersions)
    .where(inArray(formVersions.formId, formIds))
    .orderBy(formVersions.formId, desc(formVersions.version));

  return new Map(rows.map((row) => [row.formId, row]));
}

function withLatest(
  rows: FormRow[],
  latest: Map<string, FormVersionRow>,
): FormWithLatestVersion[] {
  return rows.flatMap((form) => {
    const latestVersion = latest.get(form.id);
    return latestVersion ? [{ form, latestVersion }] : [];
  });
}

export type FormVersionSummaryRow = {
  version: FormVersionRow;
  formName: string;
  category: string;
};

export const formRepository = {
  /** Versions in use by occurrences resolve here even after their form is archived. */
  async findVersionSummariesByIds(
    db: DbClient,
    versionIds: string[],
  ): Promise<FormVersionSummaryRow[]> {
    if (versionIds.length === 0) return [];

    return db
      .select({
        version: formVersions,
        formName: forms.name,
        category: forms.category,
      })
      .from(formVersions)
      .innerJoin(forms, eq(forms.id, formVersions.formId))
      .where(inArray(formVersions.id, versionIds));
  },

  async findManyActiveWithLatestVersion(
    db: DbClient,
    organizationId: string,
  ): Promise<FormWithLatestVersion[]> {
    const rows = await db
      .select()
      .from(forms)
      .where(
        and(eq(forms.organizationId, organizationId), isNull(forms.archivedAt)),
      )
      .orderBy(asc(forms.name));

    return withLatest(
      rows,
      await findLatestVersions(
        db,
        rows.map((row) => row.id),
      ),
    );
  },

  async findManyActiveOnDemandWithLatestVersion(
    db: DbClient,
    organizationId: string,
  ): Promise<FormWithLatestVersion[]> {
    const rows = await db
      .select()
      .from(forms)
      .where(
        and(
          eq(forms.organizationId, organizationId),
          eq(forms.onDemand, true),
          isNull(forms.archivedAt),
        ),
      )
      .orderBy(asc(forms.name));

    return withLatest(
      rows,
      await findLatestVersions(
        db,
        rows.map((row) => row.id),
      ),
    );
  },

  /** `lock` takes a row lock on the form so concurrent saves number their versions in turn. */
  async findActiveWithLatestVersion(
    db: DbClient,
    organizationId: string,
    formId: string,
    options: { lock?: boolean } = {},
  ): Promise<FormWithLatestVersion | null> {
    const query = db
      .select()
      .from(forms)
      .where(
        and(
          eq(forms.id, formId),
          eq(forms.organizationId, organizationId),
          isNull(forms.archivedAt),
        ),
      )
      .limit(1);

    const [form] = options.lock ? await query.for("update") : await query;
    if (!form) return null;

    const [result] = withLatest(
      [form],
      await findLatestVersions(db, [form.id]),
    );
    return result ?? null;
  },

  async insertForm(db: DbClient, data: typeof forms.$inferInsert) {
    const [created] = await db.insert(forms).values(data).returning();
    return created ?? null;
  },

  async insertVersion(db: DbClient, data: typeof formVersions.$inferInsert) {
    const [created] = await db.insert(formVersions).values(data).returning();
    return created ?? null;
  },

  async updateActive(
    db: DbClient,
    organizationId: string,
    formId: string,
    updates: Partial<typeof forms.$inferInsert>,
  ) {
    const [updated] = await db
      .update(forms)
      .set(updates)
      .where(
        and(
          eq(forms.id, formId),
          eq(forms.organizationId, organizationId),
          isNull(forms.archivedAt),
        ),
      )
      .returning({ id: forms.id });

    return updated ?? null;
  },

  /** Archives only when no active template still uses the form, in one conditional write. */
  async archiveIfUnused(
    db: DbClient,
    organizationId: string,
    formId: string,
  ): Promise<"archived" | "in_use" | "not_found"> {
    const now = new Date();
    const [archived] = await db
      .update(forms)
      .set({ archivedAt: now, updatedAt: now })
      .where(
        and(
          eq(forms.id, formId),
          eq(forms.organizationId, organizationId),
          isNull(forms.archivedAt),
          sql`NOT EXISTS (SELECT 1 FROM ${taskTemplates} WHERE ${taskTemplates.formId} = ${forms.id} AND ${taskTemplates.archivedAt} IS NULL)`,
        ),
      )
      .returning({ id: forms.id });

    if (archived) return "archived";

    const [existing] = await db
      .select({ id: forms.id })
      .from(forms)
      .where(
        and(
          eq(forms.id, formId),
          eq(forms.organizationId, organizationId),
          isNull(forms.archivedAt),
        ),
      )
      .limit(1);

    return existing ? "in_use" : "not_found";
  },

  /** Forms no active template uses are absent from the map. */
  async countActiveTemplatesByForm(
    db: DbClient,
    formIds: string[],
  ): Promise<Map<string, number>> {
    if (formIds.length === 0) return new Map();

    const rows = await db
      .select({
        formId: taskTemplates.formId,
        count: sql<number>`count(*)::int`.mapWith(Number),
      })
      .from(taskTemplates)
      .where(
        and(
          inArray(taskTemplates.formId, formIds),
          isNull(taskTemplates.archivedAt),
        ),
      )
      .groupBy(taskTemplates.formId);

    return new Map(rows.map((row) => [row.formId, row.count]));
  },

  async findActiveTemplateIdsByForm(
    db: DbClient,
    formId: string,
  ): Promise<string[]> {
    const rows = await db
      .select({ id: taskTemplates.id })
      .from(taskTemplates)
      .where(
        and(eq(taskTemplates.formId, formId), isNull(taskTemplates.archivedAt)),
      );

    return rows.map((row) => row.id);
  },

  /** How many targets each active template using this form checks, zero included. */
  async findTemplateTargetCountsByForm(
    db: DbClient,
    formId: string,
  ): Promise<{ templateId: string; targetCount: number }[]> {
    return db
      .select({
        templateId: taskTemplates.id,
        targetCount: sql<number>`count(${taskTemplateTargets.targetId})::int`,
      })
      .from(taskTemplates)
      .leftJoin(
        taskTemplateTargets,
        eq(taskTemplateTargets.taskTemplateId, taskTemplates.id),
      )
      .where(
        and(eq(taskTemplates.formId, formId), isNull(taskTemplates.archivedAt)),
      )
      .groupBy(taskTemplates.id);
  },
};
