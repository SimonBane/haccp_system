"use client";

import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

/** Mounts the one visual-viewport listener for the whole app. */
export function KeyboardInsetSync() {
  useKeyboardInset();
  return null;
}
