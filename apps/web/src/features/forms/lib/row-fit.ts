/** Whether items of these natural widths fit one row; `equal` gives every item the widest one's width. */
export function fitsOneRow(
  widths: readonly number[],
  {
    gap,
    available,
    equal = false,
  }: { gap: number; available: number; equal?: boolean },
): boolean {
  if (widths.length === 0) return true;
  const content = equal
    ? Math.max(...widths) * widths.length
    : widths.reduce((sum, width) => sum + width, 0);
  return content + gap * (widths.length - 1) <= available;
}
