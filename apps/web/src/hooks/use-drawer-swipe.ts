"use client";

import * as React from "react";

/**
 * How a closed drawer is opened by touch.
 *
 * - "anywhere": any rightward drag on the content panel, ChatGPT-style.
 * - "edge":     only a drag starting within EDGE_ZONE_PX of the leading edge.
 *
 * Closing always works from anywhere on the panel, in both modes.
 */
export type DrawerOpenMode = "edge" | "anywhere";

const PROGRESS_VAR = "--drawer-progress";
const DRAGGING_ATTR = "data-drawer-dragging";

/** Travel before the gesture is claimed as horizontal. */
const ACTIVATION_PX = 8;
/** Horizontal must beat vertical by this much, or we keep waiting. */
const AXIS_RATIO = 1.2;
/** Past this, a release is a drag rather than a tap. */
const TAP_SLOP_PX = 10;
/** Fraction of the width past which a slow release settles open. */
const SNAP_DISTANCE_RATIO = 0.4;
/** px/ms — a flick this fast wins regardless of distance. */
const SNAP_VELOCITY = 0.35;
/** Only samples this recent feed the velocity estimate. */
const VELOCITY_WINDOW_MS = 80;
const EDGE_ZONE_PX = 24;

type Sample = { x: number; t: number };

type Drag = {
  pointerId: number;
  startX: number;
  startY: number;
  /** Where the finger went down. Pointer capture retargets later events. */
  target: EventTarget | null;
  /** Progress when the finger went down — a drag can start mid-animation. */
  startProgress: number;
  /** Committed state at gesture start; pointercancel reverts to this. */
  startOpen: boolean;
  axis: "none" | "x";
  moved: boolean;
  samples: Sample[];
};

/**
 * Sub-pixel slack. Layout rounding routinely leaves `scrollWidth` a fraction
 * over `clientWidth` on a box that cannot actually scroll.
 */
const OVERFLOW_SLOP_PX = 1;

/**
 * Yields to a horizontally scrollable ancestor that still has room to move in
 * the drag direction, and to anything explicitly opted out. Without this the
 * drawer steals the gesture from tables and carousels.
 *
 * Two things this has to get right, because `ShellScroll` sets only
 * `overflow-y: auto` — which makes the *computed* `overflow-x` `auto` as well,
 * so the app's one scroll region matches the "scrollable" test on every drag:
 *
 * - a rounding-error overflow is not an overflow, hence the slop, and
 * - a box already scrolled hard against the edge the drag is pulling from has
 *   no room to move and must not claim the gesture.
 *
 * Without both, a single stray pixel of horizontal content anywhere on the page
 * silently kills the drawer everywhere.
 */
function startsInProtectedRegion(
  target: EventTarget | null,
  direction: 1 | -1,
): boolean {
  if (!(target instanceof Element)) return false;
  if (target.closest("[data-no-swipe]")) return true;

  for (
    let node: Element | null = target;
    node && node !== document.body;
    node = node.parentElement
  ) {
    const overflowX = getComputedStyle(node).overflowX;
    const scrollable = overflowX === "auto" || overflowX === "scroll";
    if (!scrollable) continue;

    const maxScroll = node.scrollWidth - node.clientWidth;
    if (maxScroll <= OVERFLOW_SLOP_PX) continue;

    // scrollLeft is negative in RTL; magnitude is what matters either way.
    const scrolled = Math.abs(node.scrollLeft);
    // Dragging right reveals content to the left, so it needs scrollLeft > 0.
    const room =
      direction > 0
        ? scrolled > OVERFLOW_SLOP_PX
        : scrolled < maxScroll - OVERFLOW_SLOP_PX;
    if (room) return true;
  }

  return false;
}

/**
 * The mobile drawer gesture: the content panel follows the finger to reveal a
 * sidebar sitting behind it, then snaps on release.
 *
 * The panel's position is a CSS custom property written straight to the DOM
 * inside a rAF — React never re-renders during a drag, and only learns the
 * final open/closed state on release.
 */
export function useDrawerSwipe({
  open,
  onOpenChange,
  enabled,
  mode = "anywhere",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
  mode?: DrawerOpenMode;
}) {
  const [root, setRoot] = React.useState<HTMLElement | null>(null);

  // Latest-value refs so the pointer listeners can stay attached across
  // renders instead of being torn down and rebuilt on every state change.
  // Declared first so this effect runs before the ones that read them.
  const openRef = React.useRef(open);
  const onOpenChangeRef = React.useRef(onOpenChange);
  React.useEffect(() => {
    openRef.current = open;
    onOpenChangeRef.current = onOpenChange;
  });

  /** Source of truth during a drag. Deliberately not React state. */
  const progressRef = React.useRef(open ? 1 : 0);
  const dragRef = React.useRef<Drag | null>(null);
  const frameRef = React.useRef(0);
  const pendingRef = React.useRef(0);
  /** Swallows the click a finished drag would otherwise synthesise. */
  const swallowClickRef = React.useRef(false);

  const writeProgress = React.useCallback(
    (value: number) => {
      progressRef.current = value;
      pendingRef.current = value;
      if (frameRef.current || !root) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        root.style.setProperty(PROGRESS_VAR, `${pendingRef.current}`);
      });
    },
    [root],
  );

  /** Settles to 0 or 1 with the CSS transition re-enabled. */
  const settle = React.useCallback(
    (next: boolean) => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
      progressRef.current = next ? 1 : 0;
      if (!root) return;

      root.removeAttribute(DRAGGING_ATTR);
      // Load-bearing: without a forced reflow the style engine coalesces
      // "stop suppressing transitions" and "jump to the target" into a single
      // change that is still untransitioned, and the panel teleports.
      void root.offsetWidth;
      root.style.setProperty(PROGRESS_VAR, next ? "1" : "0");
    },
    [root],
  );

  // Programmatic open/close: the hamburger, a nav link, Escape, the scrim.
  React.useEffect(() => {
    if (!enabled || dragRef.current) return;
    settle(open);
  }, [open, enabled, settle]);

  // Teardown when the viewport crosses the md breakpoint mid-session.
  React.useEffect(() => {
    if (enabled || !root) return;

    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }
    dragRef.current = null;
    root.removeAttribute(DRAGGING_ATTR);
    root.style.setProperty(PROGRESS_VAR, "0");
    progressRef.current = 0;
    if (openRef.current) onOpenChangeRef.current(false);
  }, [enabled, root]);

  React.useEffect(() => {
    if (!enabled || !root) return;

    const panelWidth = () => {
      const panel = root.querySelector<HTMLElement>(
        '[data-slot="sidebar"][data-mobile="true"]',
      );
      return panel?.getBoundingClientRect().width || 256;
    };

    const releaseCapture = (pointerId: number) => {
      try {
        root.releasePointerCapture(pointerId);
      } catch {
        // The pointer is already gone; nothing to release.
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.pointerType === "mouse") return;
      if (dragRef.current) return;
      // Cleared here rather than only when a click arrives: a touch drag does
      // not always synthesise one, and a flag left standing would eat the
      // next genuine tap.
      swallowClickRef.current = false;
      // Only the direction-independent half here — whether a scrollable
      // ancestor is protected depends on which way the finger goes, which is
      // not known until the axis is claimed in onPointerMove.
      if (
        event.target instanceof Element &&
        event.target.closest("[data-no-swipe]")
      ) {
        return;
      }

      const isOpen = openRef.current;
      if (!isOpen && mode === "edge") {
        const inset = root.getBoundingClientRect().left;
        if (event.clientX - inset > EDGE_ZONE_PX) return;
      }

      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        target: event.target,
        startProgress: progressRef.current,
        startOpen: isOpen,
        axis: "none",
        moved: false,
        samples: [{ x: event.clientX, t: event.timeStamp }],
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      if (Math.abs(dx) > TAP_SLOP_PX || Math.abs(dy) > TAP_SLOP_PX) {
        drag.moved = true;
      }

      if (drag.axis === "none") {
        // Only *wait* on an ambiguous sample. The previous implementation
        // discarded the gesture the moment one frame looked vertical, which
        // is exactly what a slow thumb arc produces — hence "swiping slowly
        // does nothing". The browser owns vertical panning via touch-action
        // and tells us it took over by sending pointercancel.
        if (Math.abs(dx) < ACTIVATION_PX) return;
        if (Math.abs(dx) < Math.abs(dy) * AXIS_RATIO) return;

        // A closed drawer ignores leftward drags entirely rather than
        // claiming them and clamping to zero, which is what leaves room for
        // swipe-left row actions underneath.
        if (!drag.startOpen && dx < 0) {
          dragRef.current = null;
          return;
        }

        // Now the direction is known, so a horizontally scrollable ancestor
        // can be asked whether it still has room to move this way.
        if (startsInProtectedRegion(drag.target, dx > 0 ? 1 : -1)) {
          dragRef.current = null;
          return;
        }

        drag.axis = "x";
        drag.samples.length = 0;
        try {
          root.setPointerCapture(drag.pointerId);
        } catch {
          // Capture is best-effort; the drag still tracks without it.
        }
        root.setAttribute(DRAGGING_ATTR, "");
      }

      drag.samples.push({ x: event.clientX, t: event.timeStamp });
      if (drag.samples.length > 12) drag.samples.shift();

      // Subtract the activation distance, or the panel jumps ACTIVATION_PX
      // out from under the finger on the frame the drag engages.
      const adjusted = dx - Math.sign(dx) * ACTIVATION_PX;
      const next = drag.startProgress + adjusted / panelWidth();
      writeProgress(Math.max(0, Math.min(1, next)));
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      releaseCapture(drag.pointerId);

      if (drag.axis !== "x") {
        root.removeAttribute(DRAGGING_ATTR);
        return;
      }

      swallowClickRef.current = drag.moved;

      // Velocity over the trailing window only. Measured across the whole
      // gesture, a long slow drag that ends in a decisive flick reads as slow.
      const now = event.timeStamp;
      const recent = drag.samples.filter((s) => now - s.t <= VELOCITY_WINDOW_MS);
      const first = recent[0] ?? drag.samples[0];
      const elapsed = Math.max(now - (first?.t ?? now), 1);
      const velocity = (event.clientX - (first?.x ?? event.clientX)) / elapsed;

      const shouldOpen =
        Math.abs(velocity) > SNAP_VELOCITY
          ? velocity > 0
          : progressRef.current > SNAP_DISTANCE_RATIO;

      settle(shouldOpen);
      if (shouldOpen !== openRef.current) onOpenChangeRef.current(shouldOpen);
    };

    const onPointerCancel = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      releaseCapture(drag.pointerId);

      // The browser claimed the gesture — a vertical pan, a system edge swipe,
      // a second finger. Return to where the drag started rather than commit.
      settle(drag.startOpen);
      if (drag.startOpen !== openRef.current) {
        onOpenChangeRef.current(drag.startOpen);
      }
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!swallowClickRef.current) return;
      swallowClickRef.current = false;
      event.stopPropagation();
      event.preventDefault();
    };

    root.addEventListener("pointerdown", onPointerDown, { passive: true });
    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("pointerup", onPointerUp, { passive: true });
    root.addEventListener("pointercancel", onPointerCancel, { passive: true });
    root.addEventListener("lostpointercapture", onPointerCancel, {
      passive: true,
    });
    root.addEventListener("click", onClickCapture, true);

    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerCancel);
      root.removeEventListener("lostpointercapture", onPointerCancel);
      root.removeEventListener("click", onClickCapture, true);
      if (dragRef.current) {
        releaseCapture(dragRef.current.pointerId);
        dragRef.current = null;
      }
      root.removeAttribute(DRAGGING_ATTR);
    };
  }, [enabled, root, mode, writeProgress, settle]);

  React.useEffect(() => {
    if (!enabled || !open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChangeRef.current(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, open]);

  return { rootRef: setRoot };
}
