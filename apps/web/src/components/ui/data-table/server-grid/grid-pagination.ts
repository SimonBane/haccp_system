export function gridPageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(total / pageSize));
}

export function lastPageIndex(total: number, pageSize: number): number {
  return gridPageCount(total, pageSize) - 1;
}

export function clampPageIndex(
  pageIndex: number,
  total: number,
  pageSize: number,
): number {
  return Math.min(Math.max(0, pageIndex), lastPageIndex(total, pageSize));
}
