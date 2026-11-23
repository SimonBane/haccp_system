import { FORM_CATEGORY, type FormCategory } from "@haccp/shared";

export const CORRECTIVE_SUGGESTION_KEYS = [
  "movedProduct",
  "adjustedThermostat",
  "calledService",
  "rejectedDelivery",
  "discardedProduct",
  "recleaned",
  "rechecked",
  "notifiedManager",
] as const;

export type CorrectiveSuggestionKey = (typeof CORRECTIVE_SUGGESTION_KEYS)[number];

const SUGGESTIONS_BY_CATEGORY: Record<
  FormCategory,
  readonly CorrectiveSuggestionKey[]
> = {
  [FORM_CATEGORY.TEMPERATURE]: [
    "movedProduct",
    "adjustedThermostat",
    "notifiedManager",
    "calledService",
    "rechecked",
    "discardedProduct",
  ],
  [FORM_CATEGORY.GOODS_IN]: [
    "rejectedDelivery",
    "discardedProduct",
    "notifiedManager",
  ],
  [FORM_CATEGORY.CLEANING]: ["recleaned", "notifiedManager", "rechecked"],
  [FORM_CATEGORY.HYGIENE]: ["recleaned", "notifiedManager", "rechecked"],
  [FORM_CATEGORY.PEST_CONTROL]: ["calledService", "notifiedManager"],
};

const GENERIC_SUGGESTIONS: readonly CorrectiveSuggestionKey[] = [
  "rechecked",
  "notifiedManager",
];

/** How many of a category's suggestions a new form starts with. */
export const CORRECTIVE_SEED_COUNT = 4;

export function correctiveSuggestionsFor(
  category: FormCategory | "" | null,
): readonly CorrectiveSuggestionKey[] {
  return category ? SUGGESTIONS_BY_CATEGORY[category] : GENERIC_SUGGESTIONS;
}

/** Suggestions the form does not already have, compared the way a person would read them. */
export function unusedSuggestions<T extends { label: string }>(
  suggestions: readonly T[],
  takenLabels: readonly string[],
): T[] {
  const taken = new Set(takenLabels.map((label) => label.trim().toLowerCase()));
  return suggestions.filter(
    (suggestion) => !taken.has(suggestion.label.trim().toLowerCase()),
  );
}
