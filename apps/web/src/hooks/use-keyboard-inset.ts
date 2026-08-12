"use client";

import * as React from "react";

/** Published on <html> so portalled sheets and popups can read it too. */
const KEYBOARD_INSET_VAR = "--keyboard-inset";

/**
 * Below this, a visual-viewport change is browser chrome moving rather than the
 * software keyboard appearing.
 */
const KEYBOARD_THRESHOLD_PX = 60;

function measureKeyboardInset(win: Window): number {
  const viewport = win.visualViewport;

  // No API, or the user is pinch-zoomed — in which case the numbers describe
  // the zoom rather than the keyboard.
  if (!viewport || viewport.scale !== 1) return 0;

  // On Android Chrome with `interactiveWidget: "resizes-content"` the layout
  // viewport already shrank, so this difference is ~0 and the answer is
  // correctly 0: a bottom-anchored box is above the keyboard by construction.
  // On iOS the layout viewport never shrinks, so this is the keyboard height
  // plus its accessory bar.
  if (win.innerHeight - viewport.height <= KEYBOARD_THRESHOLD_PX) return 0;

  // offsetTop, not pageTop: offsetTop is the visual viewport's offset within
  // the *layout* viewport, which is what `position: fixed` resolves against.
  // pageTop folds in window.scrollY and would double-count the layout-viewport
  // scroll iOS performs when it reveals a focused field.
  const top = Math.max(0, viewport.offsetTop);
  const bottom = Math.min(win.innerHeight, top + viewport.height);
  return Math.max(0, Math.round(win.innerHeight - bottom));
}

/**
 * Publishes `--keyboard-inset`: how much of the screen the software keyboard is
 * covering, measured from the bottom of the layout viewport.
 *
 * Mount exactly once, at the top of the client tree. There is one visual
 * viewport, so a per-surface copy would mean N listeners racing to write one
 * variable — and consumers that are not inside any sheet, like the list's
 * floating search, would get nothing.
 */
export function useKeyboardInset(): void {
  React.useEffect(() => {
    const win = window;
    const root = document.documentElement;
    const viewport = win.visualViewport;

    let frame = 0;
    let last = -1;

    const write = () => {
      frame = 0;
      const next = measureKeyboardInset(win);
      if (next === last) return;
      last = next;
      root.style.setProperty(KEYBOARD_INSET_VAR, `${next}px`);
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(write);
    };

    /*
     * iOS scrolls the *layout* viewport to reveal a focused field even though
     * `html` is `overflow: hidden` — window.scrollY goes positive and every
     * fixed element, the app bar included, slides off the top. Put it back: the
     * visual-viewport offset already tells us everything we need, and with a
     * locked document there is nothing legitimate to scroll to.
     */
    const unscroll = () => {
      if (win.scrollY !== 0 || win.scrollX !== 0) win.scrollTo(0, 0);
    };

    // Sets the property even when there is no visualViewport, so every
    // `var(--keyboard-inset, 0px)` consumer resolves against a real value.
    write();

    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    win.addEventListener("focusin", schedule);
    win.addEventListener("focusout", schedule);
    win.addEventListener("orientationchange", schedule);
    win.addEventListener("scroll", unscroll, { passive: true });

    return () => {
      if (frame) cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      win.removeEventListener("focusin", schedule);
      win.removeEventListener("focusout", schedule);
      win.removeEventListener("orientationchange", schedule);
      win.removeEventListener("scroll", unscroll);
      root.style.removeProperty(KEYBOARD_INSET_VAR);
    };
  }, []);
}
