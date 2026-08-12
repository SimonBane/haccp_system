"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

/**
 * The sRGB equivalents of `--background` in each mode.
 *
 * Literal values rather than a computed read of the token: `theme-color` has to
 * be a colour the browser's chrome can parse, and the palette is authored in
 * oklch(). Keep these in step with globals.css.
 */
const THEME_COLOR = { light: "#ffffff", dark: "#0a0a0a" } as const;

/**
 * Keeps `<meta name="theme-color">` on the surface the app is actually painting.
 *
 * A media-scoped pair of metas — which is what this replaces — resolves against
 * the *OS* colour scheme, but next-themes lets the user pick a theme that
 * differs from it. On iOS that is how a white app ends up with near-black
 * browser toolbars top and bottom, and once Safari has adopted a tint on a
 * document that never scrolls it has no reason to re-derive it.
 */
export function ThemeColorSync() {
  // `resolvedTheme` collapses "system" to light/dark and re-runs on an OS scheme
  // change, so this needs no matchMedia of its own.
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // undefined until next-themes has read storage and hydrated.
    if (!resolvedTheme) return;

    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!meta) return;

    meta.content = THEME_COLOR[resolvedTheme === "dark" ? "dark" : "light"];
  }, [resolvedTheme]);

  return null;
}
