import type { FormDefinition, LimitOverrides } from "@haccp/shared";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { DbClient } from "../../core/db/client.js";
import { formVersions } from "../../core/db/schema/form-versions.js";
import { forms } from "../../core/db/schema/forms.js";
import { locations } from "../../core/db/schema/locations.js";
import { targets } from "../../core/db/schema/targets.js";
import { taskTemplateTargets } from "../../core/db/schema/task-template-targets.js";
import { taskTemplates } from "../../core/db/schema/task-templates.js";

export type TaskTemplateRow = typeof taskTemplates.$inferSelect;

export type TaskTemplateWithFormRow = {
  template: TaskTemplateRow;
  formName: string;
  formCategory: string;
};

export type TemplateTargetRow = {
  taskTemplateId: string;
  targetId: string;
  targetName: string;
  limitOverrides: LimitOverrides;
};

export type FormForTemplateRow = {
  formId: string;
  formName: string;
  formCategory: string;
  definition: FormDefinition;
};

/** Everything reconciliation needs to know about one active template. */
export type TaskTemplateSourceRow = {
  id: string;
  locationId: string;
  title: string;
  weekdays: string[];
  scheduledTimes: string[];
  completionOpensBeforeMinutes: number;
  completionDueAfterMinutes: number | null;
  createdAt: Date;
  formVersionId: string;
  definition: FormDefinition;
  targets: {
    targetId: string;
    targetName: string;
    limitOverrides: LimitOverrides;
  }[];
};

const withFormColumns = {
  template: taskTemplates,
  formName: forms.name,
  formCategory: forms.category,
};

export const taskTemplateRepository = {
  async findManyActiveWithFormByLocation(
    db: DbClient,
    locationId: string,
  ): Promise<TaskTemplateWithFormRow[]> {
    return db
      .select(withFormColumns)
      .from(taskTemplates)
      .innerJoin(forms, eq(forms.id, taskTemplates.formId))
      .where(
        and(
          eq(taskTemplates.locationId, locationId),
          isNull(taskTemplates.archivedAt),
        ),
      )
      .orderBy(asc(taskTemplates.title));
  },

  async findActiveWithFormById(
    db: DbClient,
    locationId: string,
    templateId: string,
  ): Promise<TaskTemplateWithFormRow | null> {
    const [row] = await db
      .select(withFormColumns)
      .from(taskTemplates)
      .innerJoin(forms, eq(forms.id, taskTemplates.formId))
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

  async findTargetsByTemplateIds(
    db: DbClient,
    templateIds: string[],
  ): Promise<TemplateTargetRow[]> {
    if (templateIds.length === 0) return [];

    return db
      .select({
        taskTemplateId: taskTemplateTargets.taskTemplateId,
        targetId: targets.id,
        targetName: targets.name,
        limitOverrides: taskTemplateTargets.limitOverrides,
      })
      .from(taskTemplateTargets)
      .innerJoin(targets, eq(targets.id, taskTemplateTargets.targetId))
      .where(inArray(taskTemplateTargets.taskTemplateId, templateIds))
      .orderBy(asc(targets.name));
  },

  /** The form a template at this location may use: active, in the location's organisation, with its latest definition. */
  async findActiveFormForLocation(
    db: DbClient,
    locationId: string,
    formId: string,
  ): Promise<FormForTemplateRow | null> {
    const [form] = await db
      .select({
        formId: forms.id,
        formName: forms.name,
        formCategory: forms.category,
      })
      .from(forms)
      .innerJoin(locations, eq(locations.organizationId, forms.organizationId))
      .where(
        and(
          eq(forms.id, formId),
          eq(locations.id, locationId),
          isNull(forms.archivedAt),
        ),
      )
      .limit(1);

    if (!form) return null;

    const [latest] = await db
      .select({ definition: formVersions.definition })
      .from(formVersions)
      .where(eq(formVersions.formId, formId))
      .orderBy(desc(formVersions.version))
      .limit(1);

    return latest ? { ...form, definition: latest.definition } : null;
  },

  async findActiveTargetIdsAtLocation(
    db: DbClient,
    locationId: string,
    targetIds: string[],
  ): Promise<Set<string>> {
    if (targetIds.length === 0) return new Set();

    const rows = await db
      .select({ id: targets.id })
      .from(targets)
      .where(
        and(
          inArray(targets.id, targetIds),
          eq(targets.locationId, locationId),
          isNull(targets.archivedAt),
        ),
      );

    return new Set(rows.map((row) => row.id));
  },

  async insert(db: DbClient, data: typeof taskTemplates.$inferInsert) {
    const [created] = await db.insert(taskTemplates).values(data).returning();
    return created ?? null;
  },

  async updateActiveByIdAndLocation(
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
          isNull(taskTemplates.archivedAt),
        ),
      )
      .returning();

    return updated ?? null;
  },

  async replaceTargets(
    db: DbClient,
    taskTemplateId: string,
    locationId: string,
    links: { targetId: string; limitOverrides: LimitOverrides }[],
  ): Promise<void> {
    await db
      .delete(taskTemplateTargets)
      .where(eq(taskTemplateTargets.taskTemplateId, taskTemplateId));

    if (links.length === 0) return;

    await db.insert(taskTemplateTargets).values(
      links.map((link) => ({
        taskTemplateId,
        locationId,
        targetId: link.targetId,
        limitOverrides: link.limitOverrides,
      })),
    );
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

  /** Archived templates and archived targets resolve to nothing, so reconciliation retires their future slots. */
  async findActiveSourcesByIds(
    db: DbClient,
    templateIds: string[],
  ): Promise<TaskTemplateSourceRow[]> {
    if (templateIds.length === 0) return [];

    const templates = await db
      .select()
      .from(taskTemplates)
      .where(
        and(
          inArray(taskTemplates.id, templateIds),
          isNull(taskTemplates.archivedAt),
        ),
      );

    if (templates.length === 0) return [];

    const formIds = [...new Set(templates.map((template) => template.formId))];

    const [latestVersions, links] = await Promise.all([
      db
        .selectDistinctOn([formVersions.formId], {
          formId: formVersions.formId,
          id: formVersions.id,
          definition: formVersions.definition,
        })
        .from(formVersions)
        .where(inArray(formVersions.formId, formIds))
        .orderBy(formVersions.formId, desc(formVersions.version)),
      db
        .select({
          taskTemplateId: taskTemplateTargets.taskTemplateId,
          targetId: targets.id,
          targetName: targets.name,
          limitOverrides: taskTemplateTargets.limitOverrides,
        })
        .from(taskTemplateTargets)
        .innerJoin(targets, eq(targets.id, taskTemplateTargets.targetId))
        .where(
          and(
            inArray(
              taskTemplateTargets.taskTemplateId,
              templates.map((template) => template.id),
            ),
            isNull(targets.archivedAt),
          ),
        ),
    ]);

    const versionByForm = new Map(
      latestVersions.map((version) => [version.formId, version]),
    );
    const linksByTemplate = new Map<string, TaskTemplateSourceRow["targets"]>();
    for (const link of links) {
      const list = linksByTemplate.get(link.taskTemplateId) ?? [];
      list.push({
        targetId: link.targetId,
        targetName: link.targetName,
        limitOverrides: link.limitOverrides,
      });
      linksByTemplate.set(link.taskTemplateId, list);
    }

    return templates.flatMap((template) => {
      const version = versionByForm.get(template.formId);
      if (!version) return [];

      return [
        {
          id: template.id,
          locationId: template.locationId,
          title: template.title,
          weekdays: template.weekdays,
          scheduledTimes: template.scheduledTimes,
          completionOpensBeforeMinutes: template.completionOpensBeforeMinutes,
          completionDueAfterMinutes: template.completionDueAfterMinutes,
          createdAt: template.createdAt,
          formVersionId: version.id,
          definition: version.definition,
          targets: linksByTemplate.get(template.id) ?? [],
        },
      ];
    });
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
