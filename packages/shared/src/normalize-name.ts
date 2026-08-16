export function normalizeName(value: string | null | undefined): string {
  return value?.trim() ?? "";
}
