/**
 * Scrolls a timeline anchor into view. Anchors carry `scroll-mt-*` so they land
 * below the sticky header rather than under it.
 */
export function scrollToElementId(elementId: string): void {
  const element = document.getElementById(elementId);
  if (!element) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  element.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });
}

export function scrollToTimeGroup(groupId: string): void {
  scrollToElementId(groupId);
}
