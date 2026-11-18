import {
  API_ERROR_CODE,
  checkTemplateTargets,
  findUnusableOverrideFieldIds,
  type CreateFormInput,
  type CreateFormVersionInput,
  type DroppedOverride,
  type FormAppliesTo,
  type FormDefinition,
  type FormListResponse,
  type FormResponse,
  type LimitOverrides,
  type UpdateFormInput,
} from "@haccp/shared";
import type { Db, DbClient } from "../../core/db/client.js";
import {
  AppError,
  ConflictError,
  InternalError,
  NotFoundError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { taskOccurrenceService } from "../task-occurrences/task-occurrence.service.js";
import { toFormListItem, toFormResponse } from "./form.mapper.js";
import {
  formRepository,
  type FormWithLatestVersion,
  type TemplateOverrideRow,
} from "./form.repository.js";

function nameExists(): ConflictError {
  return new ConflictError("A form with this name already exists", {
    code: API_ERROR_CODE.FORM_NAME_EXISTS,
  });
}

/** jsonb hands keys back in its own order, so equality is checked on a key-sorted encoding. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner as Record<string, unknown>).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        )
      : inner,
  );
}

function withoutKeys(
  overrides: LimitOverrides,
  keys: string[],
): LimitOverrides {
  return Object.fromEntries(
    Object.entries(overrides).filter(([fieldId]) => !keys.includes(fieldId)),
  );
}

type OverrideChange = {
  row: TemplateOverrideRow;
  droppedFieldIds: string[];
};

function planOverrideChanges(
  previous: FormDefinition,
  next: FormDefinition,
  rows: TemplateOverrideRow[],
): { changes: OverrideChange[]; dropped: DroppedOverride[] } {
  const labels = new Map(
    previous.fields.map((field) => [field.id, field.label]),
  );
  const changes: OverrideChange[] = [];
  const dropped: DroppedOverride[] = [];

  for (const row of rows) {
    const droppedFieldIds = findUnusableOverrideFieldIds(
      previous,
      next,
      row.limitOverrides,
    );
    if (droppedFieldIds.length === 0) continue;

    changes.push({ row, droppedFieldIds });
    for (const fieldId of droppedFieldIds) {
      dropped.push({
        templateId: row.templateId,
        templateTitle: row.templateTitle,
        locationId: row.locationId,
        locationName: row.locationName,
        targetId: row.targetId,
        targetName: row.targetName,
        fieldId,
        fieldLabel: labels.get(fieldId) ?? fieldId,
        limits: row.limitOverrides[fieldId]!,
      });
    }
  }

  return { changes, dropped };
}

/** Templates already using the form must still fit after what it applies to changes. */
async function assertTemplatesFitAppliesTo(
  db: DbClient,
  formId: string,
  appliesTo: FormAppliesTo,
): Promise<void> {
  const rows = await formRepository.findTemplateTargetCountsByForm(db, formId);

  for (const { targetCount } of rows) {
    if (checkTemplateTargets(appliesTo, targetCount) !== null) {
      throw new ConflictError(
        "Tasks using this form check items that would no longer fit; change those tasks first",
        { code: API_ERROR_CODE.FORM_APPLIES_TO_IN_USE },
      );
    }
  }
}

async function loadResponse(
  db: DbClient,
  organizationId: string,
  formId: string,
): Promise<FormResponse> {
  const found = await formRepository.findActiveWithLatestVersion(
    db,
    organizationId,
    formId,
  );

  if (!found) {
    throw new InternalError("Form vanished after write");
  }

  return toFormResponse(found);
}

export const formService = {
  async list(db: Db, organizationId: string): Promise<FormListResponse> {
    const rows = await formRepository.findManyActiveWithLatestVersion(
      db,
      organizationId,
    );
    const counts = await formRepository.countActiveTemplatesByForm(
      db,
      rows.map((row) => row.form.id),
    );
    return {
      items: rows.map((row) =>
        toFormListItem(row, counts.get(row.form.id) ?? 0),
      ),
    };
  },

  async get(
    db: Db,
    organizationId: string,
    formId: string,
  ): Promise<FormResponse> {
    const found = await formRepository.findActiveWithLatestVersion(
      db,
      organizationId,
      formId,
    );

    if (!found) {
      throw new NotFoundError("Form not found");
    }

    return toFormResponse(found);
  },

  async create(
    db: Db,
    organizationId: string,
    input: CreateFormInput,
  ): Promise<FormResponse> {
    try {
      return await db.transaction(async (tx) => {
        const form = await formRepository.insertForm(tx, {
          organizationId,
          name: input.name,
          category: input.category,
          appliesTo: input.appliesTo,
        });
        if (!form) throw new InternalError("Failed to create form");

        const version = await formRepository.insertVersion(tx, {
          formId: form.id,
          version: 1,
          definition: input.definition,
        });
        if (!version) throw new InternalError("Failed to create form version");

        return toFormResponse({ form, latestVersion: version });
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDbMutationError(error, { unique: nameExists });
    }
  },

  async update(
    db: Db,
    organizationId: string,
    formId: string,
    input: UpdateFormInput,
  ): Promise<FormResponse> {
    try {
      return await db.transaction(async (tx) => {
        const current = await formRepository.findActiveWithLatestVersion(
          tx,
          organizationId,
          formId,
          { lock: true },
        );

        if (!current) {
          throw new NotFoundError("Form not found");
        }

        if (current.form.appliesTo !== input.appliesTo) {
          await assertTemplatesFitAppliesTo(tx, formId, input.appliesTo);
        }

        await formRepository.updateActive(tx, organizationId, formId, {
          name: input.name,
          category: input.category,
          appliesTo: input.appliesTo,
          updatedAt: new Date(),
        });

        return loadResponse(tx, organizationId, formId);
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      mapDbMutationError(error, { unique: nameExists });
    }
  },

  /**
   * Publishes the next version. Overrides it can no longer honour are refused with
   * their list until the admin confirms, then removed; upcoming occurrences move to it.
   */
  async createVersion(
    db: Db,
    organizationId: string,
    timeZone: string,
    formId: string,
    input: CreateFormVersionInput,
  ): Promise<FormResponse> {
    return db.transaction(async (tx) => {
      const current: FormWithLatestVersion | null =
        await formRepository.findActiveWithLatestVersion(
          tx,
          organizationId,
          formId,
          { lock: true },
        );

      if (!current) {
        throw new NotFoundError("Form not found");
      }

      if (
        canonicalJson(current.latestVersion.definition) ===
        canonicalJson(input.definition)
      ) {
        return toFormResponse(current);
      }

      const overrideRows = await formRepository.findTemplateOverridesByForm(
        tx,
        formId,
      );
      const { changes, dropped } = planOverrideChanges(
        current.latestVersion.definition,
        input.definition,
        overrideRows,
      );

      if (dropped.length > 0 && !input.confirmDroppedOverrides) {
        throw new ConflictError(
          "Saving this version would remove limit overrides set on templates",
          {
            code: API_ERROR_CODE.FORM_VERSION_DROPS_OVERRIDES,
            details: { droppedOverrides: dropped },
          },
        );
      }

      for (const { row, droppedFieldIds } of changes) {
        await formRepository.setLimitOverrides(
          tx,
          row.templateId,
          row.targetId,
          withoutKeys(row.limitOverrides, droppedFieldIds),
        );
      }

      const version = await formRepository.insertVersion(tx, {
        formId,
        version: current.latestVersion.version + 1,
        definition: input.definition,
      });
      if (!version) throw new InternalError("Failed to create form version");

      await formRepository.updateActive(tx, organizationId, formId, {
        updatedAt: new Date(),
      });

      const templateIds = await formRepository.findActiveTemplateIdsByForm(
        tx,
        formId,
      );
      await taskOccurrenceService.reconcileTemplateIds(tx, {
        templateIds,
        timeZone,
      });

      return loadResponse(tx, organizationId, formId);
    });
  },

  async delete(db: Db, organizationId: string, formId: string): Promise<void> {
    const outcome = await formRepository.archiveIfUnused(
      db,
      organizationId,
      formId,
    );

    if (outcome === "not_found") {
      throw new NotFoundError("Form not found");
    }

    if (outcome === "in_use") {
      throw new ConflictError(
        "Task templates still use this form; change or archive them first",
        { code: API_ERROR_CODE.FORM_IN_USE },
      );
    }
  },
};
