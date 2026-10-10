import type { CreateFormInput } from "@haccp/shared";
import type { APIRequestContext } from "@playwright/test";
import { json } from "./api.js";
import { E2E_PREFIX } from "./env.js";

type FormRow = { id: string; name: string };

const FRIDGE_FORM: CreateFormInput = {
  name: `${E2E_PREFIX} Fridge reading`,
  category: "temperature",
  definition: {
    correctiveAction: "required_on_fail",
    fields: [
      {
        id: "temperature",
        type: "measurement",
        label: "Temperature",
        required: true,
        unit: "celsius",
        limits: { min: 0, max: 4 },
      },
    ],
  },
};

const CLEANING_FORM: CreateFormInput = {
  name: `${E2E_PREFIX} Cleaning tick`,
  category: "cleaning",
  definition: {
    correctiveAction: "optional",
    fields: [
      { id: "cleaned", type: "checkbox", label: "Cleaned", required: true },
    ],
  },
};

/** The answers that complete a task on the cleaning form, the way a tap on its row does. */
export const CLEANING_ANSWERS = { cleaned: true };

/**
 * Forms are archived, never deleted, so seeding finds each by name and republishes the
 * canonical definition; the API skips a version when nothing changed.
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

  await json(api, "post", `/forms/${found.id}/versions`, {
    definition: form.definition,
    confirmDroppedOverrides: true,
  });
  return found.id;
}

export async function ensureE2eForms(
  api: APIRequestContext,
): Promise<{ fridgeReading: string; cleaning: string }> {
  const { items } = await json<{ items: FormRow[] }>(api, "get", "/forms");

  return {
    fridgeReading: await upsertForm(api, items, FRIDGE_FORM),
    cleaning: await upsertForm(api, items, CLEANING_FORM),
  };
}
