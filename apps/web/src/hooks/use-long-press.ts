"use client";

import * as React from "react";
import { tapFeedback } from "@/features/today/lib/haptics";

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 6;

/** Window, not a sticky flag: a touch release may not synthesise a click, and a leftover flag would eat the next tap. */
const CLICK_SUPPRESS_MS = 400;

/** Cancels on scroll: iOS momentum scroll does not reliably deliver `pointercancel`. Touch only. */
export function useLongPress(
  onLongPress: (node: HTMLElement) => void,
  enabled = true,
) {
  const onLongPressRef =
    React.useRef<(node: HTMLElement) => void>(onLongPress);

  React.useEffect(() => {
    onLongPressRef.current = onLongPress;
  });

  const [node, setNode] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!enabled || !node) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let start: { id: number; x: number; y: number } | null = null;
    let fired = false;
    let suppressClicksUntil = 0;

    const cancel = () => {
      clearTimeout(timer);
      timer = undefined;
      start = null;
      if (fired) {
        fired = false;
        suppressClicksUntil = Date.now() + CLICK_SUPPRESS_MS;
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.pointerType === "mouse") return;
      fired = false;
      start = { id: event.pointerId, x: event.clientX, y: event.clientY };
      timer = setTimeout(() => {
        if (!start) return;
        fired = true;
        start = null;
        tapFeedback(12);
        onLongPressRef.current(node);
      }, LONG_PRESS_MS);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      if (
        Math.abs(event.clientX - start.x) > MOVE_CANCEL_PX ||
        Math.abs(event.clientY - start.y) > MOVE_CANCEL_PX
      ) {
        cancel();
      }
    };

    // Capture-phase click window after a fired press so the release does not also activate the row.
    const onClickCapture = (event: MouseEvent) => {
      if (Date.now() > suppressClicksUntil) return;
      suppressClicksUntil = 0;
      event.preventDefault();
      event.stopPropagation();
    };

    // iOS selection callout is handled in globals.css; this blocks Android's context menu.
    const onContextMenu = (event: Event) => event.preventDefault();

    node.addEventListener("pointerdown", onPointerDown, { passive: true });
    node.addEventListener("pointermove", onPointerMove, { passive: true });
    node.addEventListener("pointerup", cancel, { passive: true });
    node.addEventListener("pointercancel", cancel, { passive: true });
    node.addEventListener("lostpointercapture", cancel, { passive: true });
    node.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener("scroll", cancel, { passive: true });

    return () => {
      cancel();
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", cancel);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("lostpointercapture", cancel);
      node.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("scroll", cancel);
    };
  }, [enabled, node]);

  // One callback ref: an inline setter-ref re-attaches every render and tears the listeners down.
  return { ref: setNode, node };
}
