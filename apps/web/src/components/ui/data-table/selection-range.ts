/** The shape `selectionRangeIds` needs; TanStack's `Row<TData>` satisfies it. */
type RangeRow = {
  id: string;
  getCanSelect: () => boolean;
};

/**
 * The ids a shift-click spans, inclusive of both ends, or `null` when there is
 * no usable anchor to extend from.
 *
 * The range runs over the rows as they are currently rendered — filtered,
 * sorted and paginated — so "everything in between" means what the eye sees,
 * not the order the rows arrived in. Rows that cannot be selected are skipped
 * without breaking the span around them.
 */
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

  // An anchor a filter, sort or page change has since taken off screen.
  if (from === -1 || to === -1) {
    return null;
  }

  const [start, end] = from <= to ? [from, to] : [to, from];

  return rows
    .slice(start, end + 1)
    .filter((candidate) => candidate.getCanSelect())
    .map((candidate) => candidate.id);
}
