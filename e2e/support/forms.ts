import type { CreateFormInput } from "@haccp/shared";
import type { APIRequestContext } from "@playwright/test";
import { json } from "./api.js";
import { E2E_PREFIX } from "./env.js";

type FormRow = { id: string; name: string };

// Tasks take their form's name: the seeded tasks keep a form each, so finding them by name stays
// unambiguous, and the tasks journeys create for themselves use the scratch forms.
export const FRIDGE_FORM_NAME = `${E2E_PREFIX} Fridge reading`;
export const CLEANING_FORM_NAME = `${E2E_PREFIX} Cleaning tick`;
export const ON_DEMAND_FORM_NAME = `${E2E_PREFIX} Spill clean-up`;
export const SCRATCH_TICK_FORM_NAME = `${E2E_PREFIX} Scratch tick`;
export const SCRATCH_READING_FORM_NAME = `${E2E_PREFIX} Scratch reading`;

const FRIDGE_FORM: CreateFormInput = {
  name: FRIDGE_FORM_NAME,
  category: "temperature",
  appliesTo: "per_item",
  onDemand: false,
  definition: {
    correctiveAction: "required_on_fail",
    fields: [
      {
        id: "temperature",
        type: "measurement",
        label: "Temperature",
        required: true,
        parameter: "temperature",
        unit: "celsius",
        limits: { min: 0, max: 4 },
      },
    ],
  },
};

const CLEANING_FORM: CreateFormInput = {
  name: CLEANING_FORM_NAME,
  category: "cleaning",
  appliesTo: "location",
  onDemand: false,
  definition: {
    correctiveAction: "optional",
    fields: [
      { id: "cleaned", type: "checkbox", label: "Cleaned", required: true },
    ],
  },
};

const ON_DEMAND_FORM: CreateFormInput = {
  ...CLEANING_FORM,
  name: ON_DEMAND_FORM_NAME,
  onDemand: true,
};

const SCRATCH_TICK_FORM: CreateFormInput = {
  ...CLEANING_FORM,
  name: SCRATCH_TICK_FORM_NAME,
};

const SCRATCH_READING_FORM: CreateFormInput = {
  ...FRIDGE_FORM,
  name: SCRATCH_READING_FORM_NAME,
};

/** The answers that complete a task on the cleaning form, the way a tap on its row does. */
export const CLEANING_ANSWERS = { cleaned: true };

/**
 * Forms are archived, never deleted, so seeding finds each by name, resets its settings and
 * republishes the canonical definition; the API skips a version when nothing changed.
 */
async function upsertForm(
  api: APIRequestContext,
  existing: FormRow[],
  form: CreateFormInput,
): Promise<string> {
  const found = existing.find((row) => row.name === form.name);
  if (!found) {
    return (await json<FormRow>(api, "post", "/forms", form)).id;
  }

  await json(api, "patch", `/forms/${found.id}`, {
    name: form.name,
    category: form.category,
    appliesTo: form.appliesTo,
    onDemand: form.onDemand,
  });
  await json(api, "post", `/forms/${found.id}/versions`, {
    definition: form.definition,
  });
  return found.id;
}

export async function ensureE2eForms(api: APIRequestContext): Promise<{
  fridgeReading: string;
  cleaning: string;
  onDemand: string;
  scratchTick: string;
  scratchReading: string;
}> {
  const { items } = await json<{ items: FormRow[] }>(api, "get", "/forms");

  return {
    fridgeReading: await upsertForm(api, items, FRIDGE_FORM),
    cleaning: await upsertForm(api, items, CLEANING_FORM),
    onDemand: await upsertForm(api, items, ON_DEMAND_FORM),
    scratchTick: await upsertForm(api, items, SCRATCH_TICK_FORM),
    scratchReading: await upsertForm(api, items, SCRATCH_READING_FORM),
  };
}
