"use client";

import { useEffect, useMemo } from "react";
import { createSearchCommitter, GRID_SEARCH_DEBOUNCE_MS } from "./grid-search";

export function useSearchCommitter(
  onCommit: (value: string) => void,
  delayMs: number = GRID_SEARCH_DEBOUNCE_MS,
): (value: string) => void {
  const committer = useMemo(
    () => createSearchCommitter({ onCommit, delayMs }),
    [onCommit, delayMs],
  );

  useEffect(() => committer.cancel, [committer]);

  return committer.push;
}
