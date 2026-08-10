"use client";

import {
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  Clock3Icon,
  SparklesIcon,
  ThermometerIcon,
  ThermometerSnowflakeIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { formatTemperature, formatTimeOfDay } from "../lib/format";
import type { TimeGroupState, TodayTimelineItem } from "../lib/today-timeline";

type Props = {
  item: TodayTimelineItem;
  groupState: TimeGroupState;
  /**
   * Passed down rather than read from tenant context. A context consumer
   * re-renders whenever the provider's value changes no matter what `memo`
   * says, and this is the one component in the app rendered ~40 times on the
   * primary screen — so it stays fully decoupled from tenant state.
   */
  timeZone: string;
  isSyncing: boolean;
  currentUserId: string | null;
  onActivate: (item: TodayTimelineItem) => void;
};

function typeIcon(type: TodayTimelineItem["task"]["type"]) {
  switch (type) {
    case "temperature":
      return ThermometerIcon;
    case "cleaning":
      return SparklesIcon;
    case "other":
      return Clock3Icon;
  }
}

function formatUserName(
  user: NonNullable<TodayTimelineItem["task"]["completedBy"]>,
  youLabel: string,
  currentUserId: string | null,
): string {
  if (user.id === currentUserId) return youLabel;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : user.id.slice(-6);
}

/**
 * The whole row is the target: one interactive element, a 56px tap area, and a
 * single rule the worker learns once — tap a row to do the thing it describes.
 * The overlay button keeps that promise without nesting controls inside it.
 *
 * Three zones, left to right: status disc, title with its metadata chips, and a
 * right-aligned data column. The column is what the eye scans down — readings
 * line up across cards instead of trailing off the end of a sentence — and it
 * is also what fills the dead space a wide card used to leave in the middle.
 */
export const TodayTaskRow = memo(function TodayTaskRow({
  item,
  groupState,
  timeZone,
  isSyncing,
  currentUserId,
  onActivate,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();
  const { task, isCompleted, isDeviation, priorReading } = item;

  const isTemperature = task.type === "temperature";
  const isCleaning = task.type === "cleaning";
  const reading = task.temperatureReading;
  const TypeIcon = typeIcon(task.type);

  const actionLabel = isCompleted
    ? t("actions.viewRecord")
    : isTemperature
      ? t("actions.record")
      : t("actions.complete");

  const recordedLabel =
    isCompleted && reading ? formatTemperature(reading.recordedC, locale) : null;
  const readingLabel =
    recordedLabel ??
    (!isCompleted && priorReading
      ? formatTemperature(priorReading.recordedC, locale)
      : null);
  const completedTime =
    isCompleted && task.completedAt
      ? formatTimeOfDay(task.completedAt, locale, timeZone)
      : null;
  const completedByLabel =
    isCompleted && task.completedBy
      ? formatUserName(task.completedBy, t("audit.you"), currentUserId)
      : null;

  // The equipment chip is the only chip that survives on a phone, so the chip
  // row collapses entirely when there is none — a cleaning task stays a single
  // dense line rather than reserving space for a desktop-only badge.
  const hasChipRow = Boolean(task.equipmentName);
  const hasAuditLine = Boolean(completedTime) || Boolean(completedByLabel);
  const hasDataColumn = Boolean(readingLabel) || hasAuditLine;

  const ariaLabel = [
    task.title,
    task.equipmentName,
    task.scheduledTime,
    recordedLabel ? `${recordedLabel} °C` : null,
    actionLabel,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card
      data-syncing={isSyncing || undefined}
      className={cn(
        "relative gap-0 p-0 shadow-xs transition-all",
        "has-[button:hover]:bg-muted/40 has-[button:active]:scale-[0.995]",
        isDeviation && "bg-destructive/[0.03] ring-destructive/25",
        isCompleted && !isDeviation && "bg-muted/20",
        isSyncing && "opacity-70",
      )}
    >
      <div className="flex min-h-14 items-center gap-3 px-3 py-2.5 sm:min-h-16 sm:gap-3.5 sm:px-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors sm:size-11",
            isDeviation
              ? "border-transparent bg-destructive/12 text-destructive"
              : isCompleted
                ? "border-transparent bg-success/12 text-success"
                : groupState === "overdue"
                  ? "border-destructive/35 text-destructive"
                  : groupState === "now"
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-border text-muted-foreground",
          )}
          aria-hidden
        >
          {isDeviation ? (
            <CircleAlertIcon className="size-5" />
          ) : isCompleted ? (
            <CheckIcon className="size-5" strokeWidth={2.5} />
          ) : (
            <TypeIcon className="size-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "line-clamp-2 text-[15px] leading-tight font-medium",
              isCompleted && !isDeviation && "text-foreground/70",
            )}
          >
            {task.title}
          </div>

          <div
            className={cn(
              "mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1",
              // Nothing here renders on a phone without equipment.
              !hasChipRow && "hidden sm:flex",
            )}
          >
            {/* Category on every type, not just cleaning — the disc icon is the
                only type cue left on mobile, so desktop spells it out.
                Temperature tasks put equipment first so the cold-storage chip
                leads on the shop floor. */}
            {!isTemperature ? (
              <Badge
                variant="outline"
                className="hidden font-normal text-muted-foreground sm:inline-flex"
              >
                {t(`taskTypes.${task.type}`)}
              </Badge>
            ) : null}

            {task.equipmentName ? (
              <Badge
                variant="secondary"
                className="max-w-[11rem] sm:max-w-[16rem]"
              >
                <ThermometerSnowflakeIcon />
                <span className="truncate">{task.equipmentName}</span>
              </Badge>
            ) : null}

            {isTemperature ? (
              <Badge
                variant="outline"
                className="hidden font-normal text-muted-foreground sm:inline-flex"
              >
                {t(`taskTypes.${task.type}`)}
              </Badge>
            ) : null}

            {/* On mobile the tinted card, the alert disc, the red reading and
                the corrective action strip already carry this. */}
            {isDeviation ? (
              <Badge variant="destructive" className="hidden sm:inline-flex">
                <CircleAlertIcon />
                {t("temperatureDialog.outOfRange")}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* One column for numbers, whatever the card's state: a recorded value
            when there is one, otherwise the round before it. Readings line up
            down the list, and a wide card stops ending in dead space. */}
        {hasDataColumn ? (
          <div
            className={cn(
              // Capped on mobile so a long name can never crowd out the title.
              "max-w-[42%] shrink-0 flex-col items-end gap-0.5 text-right sm:flex sm:w-44 sm:max-w-none",
              // A prior reading is context, not the task — desktop only.
              isCompleted ? "flex" : "hidden",
            )}
          >
            {readingLabel ? (
              <div
                className={cn(
                  "text-[15px] leading-tight font-semibold tabular-nums",
                  isDeviation && "text-destructive",
                  !isCompleted && "text-muted-foreground",
                )}
              >
                {readingLabel}
                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                  °C
                </span>
              </div>
            ) : null}
            {hasAuditLine ? (
              isCleaning ? (
                <div
                  className={cn(
                    "flex flex-col items-end gap-0.5 text-[13px] leading-tight text-muted-foreground",
                    !completedTime && completedByLabel && "hidden sm:flex",
                  )}
                >
                  {completedTime ? (
                    <span className="whitespace-nowrap tabular-nums">
                      {completedTime}
                    </span>
                  ) : null}
                  {completedByLabel ? (
                    <span className="hidden max-w-full truncate sm:inline">
                      {completedByLabel}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div
                  className={cn(
                    "flex min-w-0 max-w-full items-center gap-1 text-[13px] leading-tight text-muted-foreground",
                    !completedTime && completedByLabel && "hidden sm:flex",
                  )}
                >
                  {completedTime ? (
                    <span
                      className={cn(
                        "whitespace-nowrap tabular-nums",
                        !isTemperature && "hidden sm:inline",
                      )}
                    >
                      {completedTime}
                    </span>
                  ) : null}
                  {completedTime && completedByLabel ? (
                    <span
                      aria-hidden
                      className="hidden text-muted-foreground/40 sm:inline"
                    >
                      ·
                    </span>
                  ) : null}
                  {completedByLabel ? (
                    <span className="hidden truncate sm:inline">
                      {completedByLabel}
                    </span>
                  ) : null}
                </div>
              )
            ) : null}
            {!isCompleted && priorReading ? (
              <div className="whitespace-nowrap text-[13px] leading-tight text-muted-foreground/80">
                {t("row.lastReadingAt", { time: priorReading.scheduledTime })}
              </div>
            ) : null}
          </div>
        ) : null}

        {isSyncing ? (
          <Spinner className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <span className="flex shrink-0 items-center gap-1">
            {!isCompleted ? (
              <span
                className={cn(
                  "hidden rounded-md px-2.5 py-1 text-xs font-medium sm:inline-flex",
                  groupState === "now"
                    ? "bg-primary text-primary-foreground"
                    : groupState === "overdue"
                      ? "bg-destructive/10 text-destructive"
                      : "bg-secondary text-secondary-foreground",
                )}
                aria-hidden
              >
                {actionLabel}
              </span>
            ) : null}
            <ChevronRightIcon
              className="size-4 text-muted-foreground/50"
              aria-hidden
            />
          </span>
        )}
      </div>

      {isDeviation && reading?.correctiveAction ? (
        <div className="mx-3 mb-2.5 rounded-lg bg-destructive/[0.06] px-2.5 py-1.5 text-[13px] leading-snug sm:mx-4 sm:mb-3">
          <span className="font-medium">{t("audit.correctiveAction")}: </span>
          <span className="text-muted-foreground">
            {reading.correctiveAction}
          </span>
        </div>
      ) : null}

      {/* Stretched target: the row's single interactive element. */}
      <Button
        variant="ghost"
        className="absolute inset-0 h-auto w-full rounded-xl p-0 hover:bg-transparent active:translate-y-0 dark:hover:bg-transparent"
        aria-label={ariaLabel}
        disabled={isSyncing}
        onClick={() => onActivate(item)}
      />
    </Card>
  );
});
