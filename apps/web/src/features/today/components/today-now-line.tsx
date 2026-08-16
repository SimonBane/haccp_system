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

export const NOW_LINE_ID = "today-now-line";

export function TodayNowLine({
  minutes,
  isTail,
}: {
  minutes: number;
  /** Fade the rail: every round has passed, so nothing follows this marker. */
  isTail?: boolean;
}) {
  const t = useTranslations("TodayPage");
  const label = formatMinutesOfDay(minutes);

  return (
    <div
      id={NOW_LINE_ID}
      role="separator"
      aria-label={t("timeline.nowLine", { time: label })}
      className="relative flex scroll-mt-4 items-center gap-2 py-4 pl-9 sm:pl-11 md:scroll-mt-16"
    >
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
          "size-2 rounded-full bg-primary ring-[5px] ring-primary/20",
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
