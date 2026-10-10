import type { LimitOverrides } from "@haccp/shared";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DbClient } from "../../core/db/client.js";
import { formVersions } from "../../core/db/schema/form-versions.js";
import { forms } from "../../core/db/schema/forms.js";
import { locations } from "../../core/db/schema/locations.js";
import { targets } from "../../core/db/schema/targets.js";
import { taskTemplateTargets } from "../../core/db/schema/task-template-targets.js";
import { taskTemplates } from "../../core/db/schema/task-templates.js";

export type FormRow = typeof forms.$inferSelect;
export type FormVersionRow = typeof formVersions.$inferSelect;

export type FormWithLatestVersion = {
  form: FormRow;
  latestVersion: FormVersionRow;
};

export type TemplateOverrideRow = {
  templateId: string;
  templateTitle: string;
  locationId: string;
  locationName: string;
  targetId: string;
  targetName: string;
  limitOverrides: LimitOverrides;
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

export const formRepository = {
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

  /** Every active template's per-target overrides for this form, across all locations. */
  async findTemplateOverridesByForm(
    db: DbClient,
    formId: string,
  ): Promise<TemplateOverrideRow[]> {
    return db
      .select({
        templateId: taskTemplates.id,
        templateTitle: taskTemplates.title,
        locationId: locations.id,
        locationName: locations.name,
        targetId: targets.id,
        targetName: targets.name,
        limitOverrides: taskTemplateTargets.limitOverrides,
      })
      .from(taskTemplateTargets)
      .innerJoin(
        taskTemplates,
        eq(taskTemplates.id, taskTemplateTargets.taskTemplateId),
      )
      .innerJoin(locations, eq(locations.id, taskTemplateTargets.locationId))
      .innerJoin(targets, eq(targets.id, taskTemplateTargets.targetId))
      .where(
        and(eq(taskTemplates.formId, formId), isNull(taskTemplates.archivedAt)),
      )
      .orderBy(
        asc(locations.name),
        asc(taskTemplates.title),
        asc(targets.name),
      );
  },

  async setLimitOverrides(
    db: DbClient,
    templateId: string,
    targetId: string,
    limitOverrides: LimitOverrides,
  ): Promise<void> {
    await db
      .update(taskTemplateTargets)
      .set({ limitOverrides })
      .where(
        and(
          eq(taskTemplateTargets.taskTemplateId, templateId),
          eq(taskTemplateTargets.targetId, targetId),
        ),
      );
  },
};
