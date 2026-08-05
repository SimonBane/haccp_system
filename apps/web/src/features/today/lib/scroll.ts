/**
 * Scrolls a timeline group into view. Groups carry `scroll-mt-*` so they land
 * below the sticky header rather than under it.
 */
export function scrollToTimeGroup(groupId: string): void {
  const element = document.getElementById(groupId);
  if (!element) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  element.scrollIntoView({
    behavior: prefersReducedMotion ? "auto" : "smooth",
    block: "start",
  });
}
