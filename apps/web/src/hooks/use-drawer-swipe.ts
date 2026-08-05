"use client";

import * as React from "react";

const EDGE_ZONE_PX = 24;
const OPEN_THRESHOLD_PX = 56;
const AXIS_LOCK_PX = 8;
const DIRECTION_RATIO = 1.5;
const CLOSE_DISTANCE_RATIO = 0.4;
/** px per ms — a flick this fast closes regardless of distance travelled. */
const CLOSE_VELOCITY = 0.5;
const CLOSE_RESET_MS = 300;

function startsInNoSwipeZone(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-no-swipe]") !== null;
}

/**
 * Opens the mobile drawer on a rightward swipe that starts at the left screen
 * edge, the way the ChatGPT app does.
 */
export function useEdgeSwipeOpen({
  enabled,
  onOpen,
}: {
  enabled: boolean;
  onOpen: () => void;
}) {
  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    let tracking = false;
    let startX = 0;
    let startY = 0;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1) {
        tracking = false;
        return;
      }
      if (touch.clientX > EDGE_ZONE_PX || startsInNoSwipeZone(event.target)) {
        return;
      }
      tracking = true;
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!tracking || !touch) {
        return;
      }
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        tracking = false;
        return;
      }
      if (
        deltaX > OPEN_THRESHOLD_PX &&
        deltaX > Math.abs(deltaY) * DIRECTION_RATIO
      ) {
        tracking = false;
        onOpen();
      }
    };

    const stop = () => {
      tracking = false;
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", stop, { passive: true });
    window.addEventListener("touchcancel", stop, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", stop);
      window.removeEventListener("touchcancel", stop);
    };
  }, [enabled, onOpen]);
}

type DragState = {
  startX: number;
  startY: number;
  startTime: number;
  width: number;
  axis: "none" | "x";
  offset: number;
};

/**
 * Drag-to-close for the open mobile drawer: the panel follows the finger and
 * closes once the gesture passes far or fast enough.
 */
export function useDrawerDrag({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [offset, setOffset] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const drag = React.useRef<DragState | null>(null);
  const resetTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Each fresh open starts from the sheet's own enter transition, even if the
  // previous close left a drag offset behind.
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOffset(0);
      setDragging(false);
    }
  }

  React.useEffect(
    () => () => {
      if (resetTimeout.current) {
        clearTimeout(resetTimeout.current);
      }
    },
    [],
  );

  const onTouchStart = React.useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1) {
        drag.current = null;
        return;
      }
      if (startsInNoSwipeZone(event.target)) {
        return;
      }
      drag.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        width: event.currentTarget.offsetWidth,
        axis: "none",
        offset: 0,
      };
    },
    [],
  );

  const onTouchMove = React.useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      const state = drag.current;
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
        // A vertical intent belongs to the scrolling nav list, not the drawer.
        if (Math.abs(deltaY) >= Math.abs(deltaX)) {
          drag.current = null;
          return;
        }
        state.axis = "x";
        setDragging(true);
      }

      state.offset = Math.min(0, deltaX);
      setOffset(state.offset);
    },
    [],
  );

  const onTouchEnd = React.useCallback(() => {
    const state = drag.current;
    drag.current = null;
    setDragging(false);

    if (!state || state.axis !== "x") {
      setOffset(0);
      return;
    }

    const distance = -state.offset;
    const elapsed = Math.max(Date.now() - state.startTime, 1);
    const shouldClose =
      distance > state.width * CLOSE_DISTANCE_RATIO ||
      distance / elapsed > CLOSE_VELOCITY;

    if (!shouldClose) {
      setOffset(0);
      return;
    }

    // Slide the rest of the way out, then drop the inline transform so the next
    // open starts from the sheet's own enter transition.
    setOffset(-state.width);
    onClose();
    resetTimeout.current = setTimeout(() => setOffset(0), CLOSE_RESET_MS);
  }, [onClose]);

  return {
    dragging,
    style:
      offset !== 0
        ? ({ transform: `translate3d(${offset}px, 0, 0)` } as React.CSSProperties)
        : undefined,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
  };
}
