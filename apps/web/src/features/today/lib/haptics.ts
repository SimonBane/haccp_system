/** Android-only; never gate behaviour on it. */
export function tapFeedback(durationMs = 10): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(durationMs);
  }
}
