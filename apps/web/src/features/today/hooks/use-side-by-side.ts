"use client";

import { useSyncExternalStore } from "react";

/** Below this the list and an open check no longer fit next to each other. */
const SIDE_BY_SIDE_QUERY = "(min-width: 1280px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(SIDE_BY_SIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether the open check sits beside the list rather than over it. */
export function useSideBySide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(SIDE_BY_SIDE_QUERY).matches,
    () => true,
  );
}
