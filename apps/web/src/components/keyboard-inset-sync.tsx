"use client";

import { useKeyboardInset } from "@/hooks/use-keyboard-inset";

/** Mounts the one visual-viewport sync for the whole app (shell + keyboard). */
export function KeyboardInsetSync() {
  useKeyboardInset();
  return null;
}
