/**
 * Person names are stored trimmed and never null — the column is NOT NULL and an
 * absent name is the empty string, so display code can concatenate without
 * guarding. Shared because both sides of the wire normalise before comparing:
 * the API to decide whether a profile actually changed, the web app to decide
 * whether a form is dirty.
 */
export function normalizeName(value: string | null | undefined): string {
  return value?.trim() ?? "";
}
