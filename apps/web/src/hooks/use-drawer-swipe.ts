"use client";

import * as React from "react";

const AXIS_LOCK_PX = 8;
const TAP_MOVE_THRESHOLD_PX = 10;
const SNAP_DISTANCE_RATIO = 0.4;
/** px per ms — a flick this fast snaps open/closed regardless of distance. */
const SNAP_VELOCITY = 0.5;

function startsInNoSwipeZone(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-no-swipe]") !== null;
}

function getSidebarWidthPx(): number {
  if (typeof window === "undefined") {
    return 256;
  }
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return root * 16;
}

type DragState = {
  startX: number;
  startY: number;
  startOffset: number;
  startTime: number;
  axis: "none" | "x";
};

/**
 * ChatGPT-style mobile sidebar reveal: the inset follows horizontal swipes from
 * anywhere on screen, with animated snap on release and programmatic open/close.
 */
export function useSidebarReveal({
  open,
  onOpenChange,
  enabled,
  sidebarWidthPx: sidebarWidthProp,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
  sidebarWidthPx?: number;
}) {
  const [sidebarWidthPx, setSidebarWidthPx] = React.useState(
    sidebarWidthProp ?? getSidebarWidthPx(),
  );
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);

  const openRef = React.useRef(open);
  const offsetRef = React.useRef(0);
  const dragRef = React.useRef<DragState | null>(null);
  const gestureMovedRef = React.useRef(false);

  openRef.current = open;
  offsetRef.current = offset;

  React.useEffect(() => {
    if (!enabled) {
      return;
    }
    const update = () => {
      setSidebarWidthPx(sidebarWidthProp ?? getSidebarWidthPx());
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [enabled, sidebarWidthProp]);

  // Animate to target when open state changes programmatically (hamburger, nav, tap).
  React.useEffect(() => {
    if (!enabled || dragging) {
      return;
    }
    const target = open ? sidebarWidthPx : 0;
    setOffset(target);
    offsetRef.current = target;
  }, [open, sidebarWidthPx, dragging, enabled]);

  React.useEffect(() => {
    if (!enabled) {
      setOffset(0);
      offsetRef.current = 0;
      setDragging(false);
      dragRef.current = null;
    }
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1) {
        dragRef.current = null;
        return;
      }
      if (startsInNoSwipeZone(event.target)) {
        dragRef.current = null;
        return;
      }
      gestureMovedRef.current = false;
      dragRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startOffset: offsetRef.current,
        startTime: Date.now(),
        axis: "none",
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      const state = dragRef.current;
      const touch = event.touches[0];
      if (!state || !touch) {
        return;
      }

      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;

      if (state.axis === "none") {
        if (
          Math.abs(deltaX) < AXIS_LOCK_PX &&
          Math.abs(deltaY) < AXIS_LOCK_PX
        ) {
          return;
        }
        if (Math.abs(deltaY) >= Math.abs(deltaX)) {
          dragRef.current = null;
          return;
        }
        state.axis = "x";
        setDragging(true);
      }

      if (
        Math.abs(deltaX) > TAP_MOVE_THRESHOLD_PX ||
        Math.abs(deltaY) > TAP_MOVE_THRESHOLD_PX
      ) {
        gestureMovedRef.current = true;
      }

      const nextOffset = Math.max(
        0,
        Math.min(sidebarWidthPx, state.startOffset + deltaX),
      );

      event.preventDefault();
      setOffset(nextOffset);
      offsetRef.current = nextOffset;
    };

    const onTouchEnd = () => {
      const state = dragRef.current;
      dragRef.current = null;
      setDragging(false);

      if (!state || state.axis !== "x") {
        return;
      }

      const currentOffset = offsetRef.current;
      const deltaFromStart = currentOffset - state.startOffset;
      const elapsed = Math.max(Date.now() - state.startTime, 1);
      const velocity = Math.abs(deltaFromStart) / elapsed;

      let shouldOpen: boolean;
      if (velocity > SNAP_VELOCITY) {
        shouldOpen = deltaFromStart > 0;
      } else {
        shouldOpen = currentOffset > sidebarWidthPx * SNAP_DISTANCE_RATIO;
      }

      const targetOffset = shouldOpen ? sidebarWidthPx : 0;
      setOffset(targetOffset);
      offsetRef.current = targetOffset;

      if (shouldOpen !== openRef.current) {
        onOpenChange(shouldOpen);
      }
    };

    const stop = () => {
      if (dragRef.current?.axis === "x") {
        onTouchEnd();
      } else {
        dragRef.current = null;
        setDragging(false);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", stop, { passive: true });
    window.addEventListener("touchcancel", stop, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stop);
      window.removeEventListener("touchcancel", stop);
    };
  }, [enabled, sidebarWidthPx, onOpenChange]);

  const onInsetClick = React.useCallback(() => {
    if (!openRef.current) {
      return;
    }
    if (gestureMovedRef.current) {
      gestureMovedRef.current = false;
      return;
    }
    onOpenChange(false);
  }, [onOpenChange]);

  const insetStyle = React.useMemo(
    (): React.CSSProperties => ({
      transform: `translate3d(${offset}px, 0, 0)`,
    }),
    [offset],
  );

  return {
    offset,
    dragging,
    insetStyle,
    onInsetClick,
  };
}
