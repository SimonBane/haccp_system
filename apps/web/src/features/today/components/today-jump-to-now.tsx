"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { scrollToElementId } from "../lib/scroll";
import { NOW_LINE_ID } from "./today-now-line";

type Props = {
  nowLineIndex: number | null;
};

/** Must stay under the marker's `scroll-mt-*` or jumping to it immediately re-triggers the pill. */
const TOP_INSET = 56;
const BOTTOM_INSET = 64;

/**
 * Measure on scroll, not IntersectionObserver: the marker can jump from below
 * the viewport to above it without intersecting, leaving the arrow pointing the wrong way.
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
    const observer = new ResizeObserver(schedule); // Catches a group collapsing above the marker.
    observer.observe(document.body);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [nowLineIndex]);

  // Hide a stale direction on the render path rather than clearing it inside the effect.
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
