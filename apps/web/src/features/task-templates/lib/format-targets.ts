/** "Fridge 1, Fridge 2 +3" — short enough for a table cell or a mobile subtitle. */
export function summarizeTargetNames(
  names: readonly string[],
  more: (count: number) => string,
  shown = 2,
): string | null {
  if (names.length === 0) return null;

  const head = names.slice(0, shown).join(", ");
  const rest = names.length - shown;
  return rest > 0 ? `${head} ${more(rest)}` : head;
}
