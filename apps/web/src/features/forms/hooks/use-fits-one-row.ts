"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { fitsOneRow } from "../lib/row-fit";

/**
 * Measures an invisible copy of the items (`measureRef`, one child each) against `containerRef`'s
 * width; re-measured when `signature` or the width changes.
 */
export function useFitsOneRow(signature: string, { equal = false } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(true);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const update = () => {
      const widths = Array.from(
        measure.children,
        (child) => child.getBoundingClientRect().width,
      );
      const gap = Number.parseFloat(getComputedStyle(measure).columnGap) || 0;
      setFits(
        fitsOneRow(widths, { gap, available: container.clientWidth, equal }),
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, [signature, equal]);

  return { containerRef, measureRef, fits };
}
