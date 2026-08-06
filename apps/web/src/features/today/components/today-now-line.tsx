"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { formatMinutesOfDay } from "../lib/format";
import {
  RAIL_DOT_CLASSNAME,
  RAIL_SEGMENT_CLASSNAME,
  RAIL_TAIL_SEGMENT_CLASSNAME,
  UPCOMING_RAIL_CLASSNAME,
} from "./today-rail";

/** Anchor for the jump-to-now pill and for scrolling back to the live moment. */
export const NOW_LINE_ID = "today-now-line";

/**
 * The live moment on the clock axis, drawn between the last round at or before
 * now and the first one still ahead. Deliberately lighter than a section rule —
 * a full-strength line here reads as a divider, which is the mistake the old
 * header progress bar made.
 */
export function TodayNowLine({
  minutes,
  isTail,
}: {
  minutes: number;
  /** Every round has already passed, so nothing follows this marker on the
   * axis and its rail fades out instead of running down to another dot. */
  isTail?: boolean;
}) {
  const t = useTranslations("TodayPage");
  const label = formatMinutesOfDay(minutes);

  return (
    <div
      id={NOW_LINE_ID}
      role="separator"
      aria-label={t("timeline.nowLine", { time: label })}
      // py-4 around a 12px line puts this dot on the same 22px axis point as
      // every round's dot, which is what lets the rail run dot to dot without
      // a seam. Equal padding also keeps the marker from crowding the hour
      // below it, where its dot used to get lost against the passing rail.
      className="relative flex scroll-mt-28 items-center gap-2 py-4 pl-9 sm:pl-11"
    >
      {/* The rest of the day is ahead of this marker, so the rail leaving it
          is dashed whatever the round below turns out to be. */}
      <span
        aria-hidden
        className={cn(
          isTail ? RAIL_TAIL_SEGMENT_CLASSNAME : RAIL_SEGMENT_CLASSNAME,
          UPCOMING_RAIL_CLASSNAME,
        )}
      />
      <span
        aria-hidden
        className={cn(
          RAIL_DOT_CLASSNAME,
          "size-2.5 rounded-full bg-primary ring-[3px] ring-background",
        )}
      />
      <span className="text-[11px] leading-3 font-semibold tabular-nums text-primary">
        {label}
      </span>
      <span
        aria-hidden
        className="h-px flex-1 bg-gradient-to-r from-primary/35 to-transparent"
      />
    </div>
  );
}
