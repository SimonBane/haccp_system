/** Picking in single mode replaces the choice; picking it again clears it. */
export function toggleCorrectiveAnswer(
  selected: readonly string[],
  answerId: string,
  multiple: boolean,
): string[] {
  if (selected.includes(answerId)) {
    return selected.filter((id) => id !== answerId);
  }
  return multiple ? [...selected, answerId] : [answerId];
}
