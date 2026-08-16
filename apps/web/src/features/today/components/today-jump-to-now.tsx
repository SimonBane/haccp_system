"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { scrollToElementId } from "../lib/scroll";
import { NOW_LINE_ID } from "./today-now-line";

type Props = {
  /** Null on any day that is not today, where there is no now marker at all. */
  nowLineIndex: number | null;
};

/**
 * Clearance for the sticky chrome that overlays the top of the page — the
 * mobile top bar, or the desktop sticky header. Both are 56px.
 *
 * Must stay under the marker's own `scroll-mt-*` landing position, or jumping
 * to it would immediately re-trigger the pill.
 */
const TOP_INSET = 56;
/** Keeps the pill from flickering as the marker grazes the bottom edge. */
const BOTTOM_INSET = 64;

/**
 * Mounted on a wall tablet, this page sits open while the day moves underneath
 * it. When the live moment scrolls out of view this offers the way back, and
 * points in the direction it went.
 *
 * Measured on scroll rather than with an IntersectionObserver: the marker can
 * go from below the viewport to above it without ever intersecting — a jump, or
 * a group collapsing — and an observer never fires for that, leaving the arrow
 * pointing the wrong way.
 */
export function TodayJumpToNow({ nowLineIndex }: Props) {
  const t = useTranslations("TodayPage");
  const [direction, setDirection] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (nowLineIndex === null) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const element = document.getElementById(NOW_LINE_ID);
      if (!element) return;

      const viewportHeight = window.innerHeight;
      const { top, bottom } = element.getBoundingClientRect();
      const isVisible =
        bottom > TOP_INSET && top < viewportHeight - BOTTOM_INSET;

      setDirection(isVisible ? null : top < TOP_INSET ? "up" : "down");
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Catches what `resize` misses — a group collapsing above the marker.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [nowLineIndex]);

  // Gated on the render path rather than cleared inside the effect: a stale
  // direction simply stays hidden until the next measurement.
  if (nowLineIndex === null || !direction) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-30 flex justify-center">
      <Button
        size="sm"
        className="pointer-events-auto h-9 gap-1.5 rounded-full px-4 shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        onClick={() => scrollToElementId(NOW_LINE_ID)}
      >
        {direction === "up" ? (
          <ArrowUpIcon className="size-3.5" />
        ) : (
          <ArrowDownIcon className="size-3.5" />
        )}
        {t("timeline.jumpToNow")}
      </Button>
    </div>
  );
}
