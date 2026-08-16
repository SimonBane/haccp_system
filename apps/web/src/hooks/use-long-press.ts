"use client";

import * as React from "react";
import { tapFeedback } from "@/features/today/lib/haptics";

/** Matches the platform's own press-and-hold delay. */
const LONG_PRESS_MS = 500;

/** Tight enough that any real drag cancels the press before it fires. */
const MOVE_CANCEL_PX = 6;

/**
 * How long after a fired press a click is treated as its leftover.
 *
 * A window rather than a "swallow the next click" flag, because a touch release
 * does not reliably synthesise a click at all — and a flag left standing then
 * eats the user's next real tap, which here is whichever action they picked in
 * the sheet that just opened.
 */
const CLICK_SUPPRESS_MS = 400;

/**
 * Press and hold a row to see what you can do to it.
 *
 * Cancels on scroll, because iOS momentum scroll does not reliably deliver
 * `pointercancel` and a press that survives a flick fires under the user's
 * thumb half a screen later.
 *
 * Touch only. A mouse gets `onContextMenu` on the row, which reaches the same
 * actions, and a keyboard gets the row's own actions button.
 */
export function useLongPress(
  /** Receives the pressed element, so a caller can anchor a popup to it. */
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

    // Also the pointerup/pointercancel handler: once the press has fired, the
    // release that ends it is the one whose click must not reach the row.
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
        // The only confirmation the press landed — nothing has moved yet.
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

    /*
     * The release that ends a long press must not also activate the row.
     * Capture phase on the document, because the click can be retargeted to a
     * child — and scoped to a short window after the release, so a press that
     * synthesises no click cannot leave a flag standing that eats the next one.
     */
    const onClickCapture = (event: MouseEvent) => {
      if (Date.now() > suppressClicksUntil) return;
      suppressClicksUntil = 0;
      event.preventDefault();
      event.stopPropagation();
    };

    // iOS raises a selection callout on long press and Android a context menu.
    // -webkit-touch-callout in globals.css handles the first; this handles the
    // second, and both would otherwise land on top of the sheet.
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

  // The node comes back out so a caller can anchor a popup to what was pressed
  // without adding a second ref. Two refs on one element means an inline
  // callback, which React re-attaches on every render — and re-attaching a
  // `useState` setter ref detaches to null and back on each pass, tearing these
  // listeners down and rebuilding them continuously.
  return { ref: setNode, node };
}
