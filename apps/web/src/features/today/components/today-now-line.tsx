"use client";

import { useTranslations } from "next-intl";
import { formatMinutesOfDay } from "../lib/format";

/** Anchor for the jump-to-now pill and for scrolling back to the live moment. */
export const NOW_LINE_ID = "today-now-line";

/**
 * The live moment on the clock axis, drawn between the last round at or before
 * now and the first one still ahead. Deliberately lighter than a section rule —
 * a full-strength line here reads as a divider, which is the mistake the old
 * header progress bar made.
 */
export function TodayNowLine({ minutes }: { minutes: number }) {
  const t = useTranslations("TodayPage");
  const label = formatMinutesOfDay(minutes);

  return (
    <div
      id={NOW_LINE_ID}
      role="separator"
      aria-label={t("timeline.nowLine", { time: label })}
      // Extra bottom space versus the row's own top padding: packed tight
      // against the next hour, the marker's dot was easy to miss against the
      // rail passing right by it.
      className="relative flex scroll-mt-28 items-center gap-2 pt-1.5 pb-4 pl-9 sm:pl-11"
    >
      <span
        aria-hidden
        className="absolute left-[13px] size-2.5 -translate-x-1/2 rounded-full bg-primary ring-[3px] ring-background sm:left-[15px]"
      />
      <span className="text-[11px] leading-none font-semibold tabular-nums text-primary">
        {label}
      </span>
      <span
        aria-hidden
        className="h-px flex-1 bg-gradient-to-r from-primary/35 to-transparent"
      />
    </div>
  );
}
