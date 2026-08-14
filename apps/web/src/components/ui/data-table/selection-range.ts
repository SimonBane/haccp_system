type RangeRow = {
  id: string;
  getCanSelect: () => boolean;
};

export function selectionRangeIds(
  rows: readonly RangeRow[],
  anchorId: string | null,
  rowId: string,
): string[] | null {
  if (anchorId === null) {
    return null;
  }

  const from = rows.findIndex((candidate) => candidate.id === anchorId);
  const to = rows.findIndex((candidate) => candidate.id === rowId);

  if (from === -1 || to === -1) {
    return null;
  }

  const [start, end] = from <= to ? [from, to] : [to, from];

  return rows
    .slice(start, end + 1)
    .filter((candidate) => candidate.getCanSelect())
    .map((candidate) => candidate.id);
}
