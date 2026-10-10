import { FORM_CATEGORY, type FormCategory } from "@haccp/shared";

const PRESET_DELIMITER = ", ";

/** Headroom for presets inside the API's 1000-character field. */
export const NOTES_MAX_LENGTH = 900;

export const CORRECTIVE_PRESET_KEYS = [
  "movedProduct",
  "adjustedThermostat",
  "calledService",
  "rejectedDelivery",
  "discardedProduct",
  "recleaned",
  "rechecked",
  "notifiedManager",
] as const;

export type CorrectivePresetKey = (typeof CORRECTIVE_PRESET_KEYS)[number];

const PRESETS_BY_CATEGORY: Record<
  FormCategory,
  readonly CorrectivePresetKey[]
> = {
  [FORM_CATEGORY.TEMPERATURE]: [
    "movedProduct",
    "adjustedThermostat",
    "notifiedManager",
    "calledService",
  ],
  [FORM_CATEGORY.COOLING]: [
    "movedProduct",
    "discardedProduct",
    "notifiedManager",
    "calledService",
  ],
  [FORM_CATEGORY.COOKING]: ["rechecked", "discardedProduct", "notifiedManager"],
  [FORM_CATEGORY.GOODS_IN]: [
    "rejectedDelivery",
    "discardedProduct",
    "notifiedManager",
  ],
  [FORM_CATEGORY.CLEANING]: ["recleaned", "notifiedManager"],
  [FORM_CATEGORY.HYGIENE]: ["recleaned", "notifiedManager"],
  [FORM_CATEGORY.PEST_CONTROL]: ["calledService", "notifiedManager"],
  [FORM_CATEGORY.OTHER]: ["rechecked", "notifiedManager"],
};

/** Quick picks that make sense for the kind of check that failed. */
export function correctivePresetsFor(
  category: FormCategory | null,
): readonly CorrectivePresetKey[] {
  return category ? PRESETS_BY_CATEGORY[category] : PRESETS_BY_CATEGORY.other;
}

export function composeCorrectiveAction(
  presetLabels: string[],
  notes: string,
): string {
  const trimmedNotes = notes.trim();
  const parts = [...presetLabels];
  if (trimmedNotes) parts.push(trimmedNotes);
  return parts.join(PRESET_DELIMITER);
}
