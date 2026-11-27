import {
  changedParameterFieldIds,
  checkTemplateTargets,
  formDefinitionSchema,
  itemLimitsSchema,
  scheduledTimeSchema,
  TARGET_KIND,
  TARGET_NAME_MAX_LENGTH,
  FORM_NAME_MAX_LENGTH,
} from "@haccp/shared";
import { describe, expect, it } from "vitest";
import {
  SEED_FORMS,
  SEED_ON_DEMAND,
  SEED_TARGETS,
  SEED_TEMPLATES,
  seedStaffEmail,
} from "./catalog.js";

const targetsByKey = new Map(SEED_TARGETS.map((target) => [target.key, target]));
const formsByKey = new Map(SEED_FORMS.map((form) => [form.key, form]));

describe("seed catalog", () => {
  it("publishes only definitions the form builder would accept", () => {
    for (const form of SEED_FORMS) {
      expect(form.name.length).toBeLessThanOrEqual(FORM_NAME_MAX_LENGTH);
      for (const version of form.versions) {
        expect(formDefinitionSchema.safeParse(version.definition).success).toBe(true);
      }
    }
  });

  it("keeps each measurement's parameter across versions", () => {
    for (const form of SEED_FORMS) {
      for (let index = 1; index < form.versions.length; index += 1) {
        expect(
          changedParameterFieldIds(
            form.versions[index - 1]!.definition,
            form.versions[index]!.definition,
          ),
        ).toEqual([]);
      }
    }
  });

  it("builds a valid item tree", () => {
    expect(targetsByKey.size).toBe(SEED_TARGETS.length);
    const scoped = new Set<string>();

    for (const target of SEED_TARGETS) {
      expect(target.name.length).toBeLessThanOrEqual(TARGET_NAME_MAX_LENGTH);
      const parent = target.parent ? targetsByKey.get(target.parent) : undefined;
      if (target.parent) expect(parent?.kind).toBe(TARGET_KIND.AREA);
      if (target.kind === TARGET_KIND.COMPONENT) {
        expect(parent).toBeDefined();
        expect(target.limits).toBeUndefined();
      }
      if (target.limits) {
        expect(itemLimitsSchema.safeParse(target.limits).success).toBe(true);
      }
      const scope =
        target.kind === TARGET_KIND.COMPONENT ? `${target.parent}|${target.name}` : target.name;
      expect(scoped.has(scope)).toBe(false);
      scoped.add(scope);
    }
  });

  it("schedules tasks the app would accept", () => {
    for (const template of SEED_TEMPLATES) {
      const form = formsByKey.get(template.form);
      expect(form?.onDemand).toBe(false);
      expect(checkTemplateTargets(form!.appliesTo, template.targets.length)).toBeNull();
      for (const key of template.targets) expect(targetsByKey.has(key)).toBe(true);
      for (const time of template.times) {
        expect(scheduledTimeSchema.safeParse(time).success).toBe(true);
      }
    }
  });

  it("logs on-demand entries only for on-demand forms and existing items", () => {
    for (const plan of SEED_ON_DEMAND) {
      const form = formsByKey.get(plan.form);
      expect(form?.onDemand).toBe(true);
      expect(checkTemplateTargets(form!.appliesTo, plan.targets.length)).toBeNull();
      for (const key of plan.targets) expect(targetsByKey.has(key)).toBe(true);
    }
  });

  it("mints staff emails unique per organization", () => {
    expect(seedStaffEmail("ivan", "9a90ec90-0000")).not.toBe(
      seedStaffEmail("ivan", "1b2c3d4e-0000"),
    );
  });
});
