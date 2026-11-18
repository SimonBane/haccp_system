"use client";

import {
  sortScheduledTimes,
  sortWeekdays,
  type TaskTemplateWeekday,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  formatDuration,
  formatWindowRange,
  type WindowLabels,
} from "@/features/task-templates/lib/completion-window";
import { detectRepeatInterval, matchDayPreset } from "@/features/task-templates/lib/schedule";

/** Locale-aware text for days, durations, windows and time lists, shared by the list, day plan and builder. */
export function useScheduleLabels() {
  const t = useTranslations("TasksPage");

  return useMemo(() => {
    const windowLabels: WindowLabels = {
      duration: {
        minutes: (count) => t("duration.minutes", { count }),
        hours: (count) => t("duration.hours", { count }),
        hoursMinutes: (hours, minutes) => t("duration.hoursMinutes", { hours, minutes }),
      },
      anyTime: t("window.anyTime"),
      startAtTime: t("window.startAtTime"),
      startAtStartOfDay: t("window.startAtStartOfDay"),
      startBefore: (duration) => t("window.startBefore", { duration }),
      endAtTime: t("window.endAtTime"),
      endAfter: (duration) => t("window.endAfter", { duration }),
      range: (start, end) => t("window.range", { start, end }),
      rangeNoDeadline: (start) => t("window.rangeNoDeadline", { start }),
    };

    const duration = (minutes: number) => formatDuration(minutes, windowLabels.duration);

    const days = (weekdays: readonly TaskTemplateWeekday[]) => {
      const preset = matchDayPreset(weekdays);
      if (preset === "every") return t("presets.everyDay");
      if (preset === "weekdays") return t("presets.weekdays");
      if (preset === "weekends") return t("presets.weekends");
      return sortWeekdays([...weekdays])
        .map((day) => t(`weekdaysShort.${day}`))
        .join(", ");
    };

    /** Up to `inline` times are listed; longer evenly spaced runs read as "8× · every 2 h, 08:00–22:00". */
    const times = (scheduledTimes: readonly string[], inline = 4) => {
      const sorted = sortScheduledTimes([...scheduledTimes]);
      if (sorted.length <= inline) return sorted.join(", ");
      const every = detectRepeatInterval(sorted);
      if (every) {
        return t("timesEvery", {
          count: sorted.length,
          interval: duration(every),
          from: sorted[0]!,
          until: sorted.at(-1)!,
        });
      }
      return t("timesMore", {
        times: sorted.slice(0, inline - 1).join(", "),
        count: sorted.length - (inline - 1),
      });
    };

    return {
      windowLabels,
      duration,
      days,
      times,
      window: (window: { opensBefore: number; dueAfter: number | null } | null) =>
        formatWindowRange(window, windowLabels),
    };
  }, [t]);
}

export type ScheduleLabels = ReturnType<typeof useScheduleLabels>;
