"use client";

import { FORM_CATEGORY } from "@haccp/shared";
import {
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ShapesIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import { primaryMeasurement } from "@/features/forms/lib/answer-summary";
import { FORM_CATEGORY_ICONS } from "@/features/forms/lib/category-icon";
import { cn } from "@/lib/utils";
import { formatTimeOfDay } from "../lib/format";
import { occurrenceKey } from "../lib/today-grouping";
import { needsRecordFlow } from "../lib/today-round";
import type { TodayTimelineItem } from "../lib/today-timeline";

type Props = {
  item: TodayTimelineItem;
  /** Prop, not tenant context: a context consumer would bypass `memo`. */
  timeZone: string;
  isSyncing: boolean;
  currentUserId: string | null;
  onActivate: (item: TodayTimelineItem) => void;
};

function formatUserName(
  user: NonNullable<TodayTimelineItem["task"]["completedBy"]>,
  youLabel: string,
  currentUserId: string | null,
): string {
  if (user.id === currentUserId) return youLabel;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : user.id.slice(-6);
}

export const TodayTaskRow = memo(function TodayTaskRow({
  item,
  timeZone,
  isSyncing,
  currentUserId,
  onActivate,
}: Props) {
  const t = useTranslations("TodayPage");
  const tForms = useTranslations("Forms");
  const locale = useLocale();
  const format = useAnswerFormat();
  const { task, form, isCompleted, isDeviation, priorRecord, liveStatus } =
    item;

  const category = form?.category ?? FORM_CATEGORY.OTHER;
  const TypeIcon = FORM_CATEGORY_ICONS[category];
  const needsEntry = needsRecordFlow(item);
  const reading = isCompleted ? primaryMeasurement(task.values) : null;
  const priorReading = priorRecord
    ? primaryMeasurement(priorRecord.values)
    : null;

  const isAvailable = liveStatus !== "upcoming";
  const availableAtLabel = t("row.availableAt", {
    time: formatTimeOfDay(task.availableAt, locale, timeZone),
  });

  const actionLabel = isCompleted
    ? t("actions.viewRecord")
    : !isAvailable
      ? availableAtLabel
      : needsEntry
        ? t("actions.record")
        : t("actions.complete");

  const recordedLabel =
    reading && reading.value !== null
      ? format.measurement(reading.value, reading.unit)
      : null;
  const priorLabel =
    !isCompleted && isAvailable && priorReading?.value != null
      ? format.measurement(priorReading.value, priorReading.unit)
      : null;
  const readingLabel = recordedLabel ?? priorLabel;
  const completedTime =
    isCompleted && task.completedAt
      ? formatTimeOfDay(task.completedAt, locale, timeZone)
      : null;
  const completedByLabel =
    isCompleted && task.completedBy
      ? formatUserName(task.completedBy, t("audit.you"), currentUserId)
      : null;

  const hasChipRow = Boolean(task.targetName);
  const hasAuditLine = Boolean(completedTime) || Boolean(completedByLabel);
  const hasDataColumn = Boolean(readingLabel) || hasAuditLine;

  const ariaLabel = [
    task.title,
    task.targetName,
    task.scheduledTime,
    recordedLabel,
    actionLabel,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Card
      data-testid="today-task-row"
      data-occurrence-key={occurrenceKey(task)}
      data-completed={isCompleted || undefined}
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
                : liveStatus === "overdue"
                  ? "border-destructive/35 text-destructive"
                  : liveStatus === "pending"
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
              !hasChipRow && "hidden sm:flex",
            )}
          >
            {task.targetName ? (
              <Badge
                variant="secondary"
                className="max-w-[11rem] sm:max-w-[16rem]"
              >
                <ShapesIcon />
                <span className="truncate">{task.targetName}</span>
              </Badge>
            ) : null}

            <Badge
              variant="outline"
              className="hidden font-normal text-muted-foreground sm:inline-flex"
            >
              {tForms(`categories.${category}`)}
            </Badge>

            {isDeviation ? (
              <Badge variant="destructive" className="hidden sm:inline-flex">
                <CircleAlertIcon />
                {t("row.needsAttention")}
              </Badge>
            ) : null}
          </div>
        </div>

        {hasDataColumn ? (
          <div
            className={cn(
              "max-w-[42%] shrink-0 flex-col items-end gap-0.5 text-right sm:flex sm:w-44 sm:max-w-none",
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
              </div>
            ) : null}
            {hasAuditLine ? (
              !readingLabel ? (
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
                    <span className="whitespace-nowrap tabular-nums">
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
            {priorLabel && priorRecord ? (
              <div className="whitespace-nowrap text-[13px] leading-tight text-muted-foreground/80">
                {t("row.lastReadingAt", { time: priorRecord.scheduledTime })}
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
                  !isAvailable
                    ? "bg-secondary text-muted-foreground"
                    : liveStatus === "pending"
                      ? "bg-primary text-primary-foreground"
                      : liveStatus === "overdue"
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

      {isDeviation && task.correctiveAction ? (
        <div className="mx-3 mb-2.5 rounded-lg bg-destructive/[0.06] px-2.5 py-1.5 text-[13px] leading-snug sm:mx-4 sm:mb-3">
          <span className="font-medium">{t("audit.correctiveAction")}: </span>
          <span className="text-muted-foreground">{task.correctiveAction}</span>
        </div>
      ) : null}

      <Button
        variant="ghost"
        className="absolute inset-0 h-auto w-full rounded-xl p-0 hover:bg-transparent active:translate-y-0 dark:hover:bg-transparent"
        aria-label={ariaLabel}
        data-testid="today-task-activate"
        data-available={isAvailable || undefined}
        disabled={isSyncing || (!isCompleted && !isAvailable)}
        onClick={() => onActivate(item)}
      />
    </Card>
  );
});
