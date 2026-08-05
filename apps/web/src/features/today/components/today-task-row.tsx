"use client";

import {
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  Clock3Icon,
  SparklesIcon,
  ThermometerIcon,
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
 */
export const TodayTaskRow = memo(function TodayTaskRow({
  item,
  groupState,
  isSyncing,
  currentUserId,
  onActivate,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();
  const { task, isCompleted, isDeviation, priorReading } = item;

  const isTemperature = task.type === "temperature";
  const reading = task.temperatureReading;
  const TypeIcon = typeIcon(task.type);

  const actionLabel = isCompleted
    ? t("actions.viewRecord")
    : isTemperature
      ? t("actions.record")
      : t("actions.complete");

  const showEquipment =
    task.equipmentName &&
    !task.title.toLowerCase().includes(task.equipmentName.toLowerCase());

  const meta: string[] = [];
  if (isCompleted) {
    if (reading) meta.push(`${formatTemperature(reading.recordedC, locale)} °C`);
    if (task.completedAt) meta.push(formatTimeOfDay(task.completedAt, locale));
    if (task.completedBy) {
      meta.push(formatUserName(task.completedBy, t("audit.you"), currentUserId));
    }
  } else {
    if (isTemperature && task.minTempC !== null && task.maxTempC !== null) {
      meta.push(
        t("row.targetRange", {
          min: formatTemperature(task.minTempC, locale),
          max: formatTemperature(task.maxTempC, locale),
        }),
      );
    } else {
      meta.push(t(`taskTypes.${task.type}`));
    }
    if (priorReading) {
      meta.push(
        t("row.priorReading", {
          time: priorReading.scheduledTime,
          value: formatTemperature(priorReading.recordedC, locale),
        }),
      );
    }
  }

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
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] leading-tight text-muted-foreground">
            <span className="truncate">
              {showEquipment ? (
                <span className="hidden sm:inline">
                  {task.equipmentName}
                  <span className="px-1.5 text-muted-foreground/40">·</span>
                </span>
              ) : null}
              {meta.join(" · ")}
            </span>
            {/* On mobile the tinted card, the alert disc and the corrective
                action strip already carry this without stealing the meta line. */}
            {isDeviation ? (
              <Badge
                variant="destructive"
                className="hidden shrink-0 sm:inline-flex"
              >
                <CircleAlertIcon />
                {t("temperatureDialog.outOfRange")}
              </Badge>
            ) : null}
          </div>
        </div>

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
        aria-label={`${task.title}, ${task.scheduledTime}, ${actionLabel}`}
        disabled={isSyncing}
        onClick={() => onActivate(item)}
      />
    </Card>
  );
});
