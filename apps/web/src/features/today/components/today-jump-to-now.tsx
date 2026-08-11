"use client";

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useScrollContainer } from "@/components/layout/shell-scroll";
import { ShellOverlay } from "@/components/layout/shell-slots";
import { Button } from "@/components/ui/button";
import { scrollToElementId } from "../lib/scroll";
import { NOW_LINE_ID } from "./today-now-line";

type Props = {
  /** Null on any day that is not today, where there is no now marker at all. */
  nowLineIndex: number | null;
};

/**
 * Clearance at the top of the scrollport. Only the desktop sticky header sits
 * inside the region and overlays the marker; on mobile the top bar is chrome
 * outside it, so a couple of pixels is enough.
 *
 * Must stay under the marker's own `scroll-mt-*` landing position, or jumping
 * to it would immediately re-trigger the pill.
 */
const TOP_INSET_MOBILE = 8;
const TOP_INSET_DESKTOP = 56;
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
  const scroller = useScrollContainer();
  const [direction, setDirection] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (nowLineIndex === null || !scroller) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const element = document.getElementById(NOW_LINE_ID);
      if (!element) return;

      // Measured against the scrollport, not the viewport: the region is
      // inset by the top bar and by the desktop card's own margin, and
      // window.innerHeight knows about neither.
      const port = scroller.getBoundingClientRect();
      const topInset =
        port.width < 768 ? TOP_INSET_MOBILE : TOP_INSET_DESKTOP;
      const { top, bottom } = element.getBoundingClientRect();
      const isVisible =
        bottom > port.top + topInset && top < port.bottom - BOTTOM_INSET;

      setDirection(
        isVisible ? null : top < port.top + topInset ? "up" : "down",
      );
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    schedule();
    scroller.addEventListener("scroll", schedule, { passive: true });
    // Catches what `resize` misses: the top bar changing height, the software
    // keyboard, and the desktop sidebar collapsing.
    const observer = new ResizeObserver(schedule);
    observer.observe(scroller);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", schedule);
      observer.disconnect();
    };
  }, [nowLineIndex, scroller]);

  // Gated on the render path rather than cleared inside the effect: a stale
  // direction simply stays hidden until the next measurement.
  if (nowLineIndex === null || !direction) return null;

  return (
    <ShellOverlay>
      <div className="absolute inset-x-0 bottom-3 flex justify-center">
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
    </ShellOverlay>
  );
}
