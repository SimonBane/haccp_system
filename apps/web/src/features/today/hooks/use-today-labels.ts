"use client";

import type { TodayTaskItem } from "@haccp/shared";
import { useLocale, useTranslations } from "next-intl";
import { formatTimeOfDay } from "../lib/format";
import type { TaskWindow, TodayGroup } from "../lib/today-day";

/** The wording a task row and its open panel share, so the two never disagree. */
export function useTodayLabels(currentUserId: string, timeZone: string) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();

  function who(user: TodayTaskItem["completedBy"]): string {
    if (!user) return "";
    if (user.id === currentUserId) return t("audit.you");
    return `${user.firstName} ${user.lastName}`.trim();
  }

  function completion(
    completedAt: string | null,
    user: TodayTaskItem["completedBy"],
  ): string {
    return [
      completedAt ? formatTimeOfDay(completedAt, locale, timeZone) : "",
      who(user),
    ]
      .filter(Boolean)
      .join(" · ");
  }

  /** The completion window when the task has one, otherwise just its time. */
  function when(window: TaskWindow | null, scheduledTime: string): string {
    if (!window) return scheduledTime;
    if (window.opensAt && window.dueAt) {
      return t("row.window.range", { from: window.opensAt, to: window.dueAt });
    }
    return window.opensAt
      ? t("row.window.from", { time: window.opensAt })
      : t("row.window.until", { time: window.dueAt ?? "" });
  }

  function progress(group: TodayGroup): string {
    if (group.doneCount > 0) {
      return t("row.filledIn", {
        done: group.doneCount,
        total: group.checks.length,
      });
    }
    return group.checks.length > 1
      ? t("row.items", { count: group.checks.length })
      : t("row.questions", {
          count: group.form?.definition.fields.length ?? 0,
        });
  }

  return { completion, when, progress };
}
