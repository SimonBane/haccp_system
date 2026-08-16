"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

/** sRGB `--background` for `theme-color` (oklch cannot be parsed by browser chrome). */
const THEME_COLOR = { light: "#ffffff", dark: "#0a0a0a" } as const;

/** Keep theme-color on the app theme, not the OS scheme. */
export function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;

    const meta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    if (!meta) return;

    meta.content = THEME_COLOR[resolvedTheme === "dark" ? "dark" : "light"];
  }, [resolvedTheme]);

  return null;
}
