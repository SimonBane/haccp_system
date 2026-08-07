/**
 * A short tick on the actions that commit something. Gloved hands in a cold room
 * get no tactile feedback from glass, so this is often the only confirmation
 * that a tap registered.
 *
 * Android only — iOS Safari has no Vibration API — so treat it as an
 * enhancement and never gate behaviour on it. Only fire it for presses that
 * actually changed something: buzzing on a no-op teaches the wrong thing.
 */
export function tapFeedback(durationMs = 10): void {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(durationMs);
  }
}
