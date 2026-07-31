"use client";

import type { TodayTaskItem } from "@haccp/shared";
import { computeTodayTaskStatus } from "@haccp/shared";
import { CircleAlertIcon, Clock3Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { memo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { minutesUntilScheduled, type TodayUiBucket } from "../lib/today-grouping";
import { TodayTaskRow } from "./today-task-row";

type Props = {
  task: TodayTaskItem;
  bucket: TodayUiBucket;
  now: Date;
  isPending: boolean;
  currentUserId: string | null;
  onComplete: (task: TodayTaskItem) => void;
  onUndo: (task: TodayTaskItem) => void;
  onRecordTemperature: (task: TodayTaskItem) => void;
};

function formatUserName(
  user: NonNullable<TodayTaskItem["completedBy"]>,
): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : user.id.slice(-6);
}

function taskTypeLabel(
  type: TodayTaskItem["type"],
  t: ReturnType<typeof useTranslations<"TodayPage">>,
): string {
  switch (type) {
    case "cleaning":
      return t("taskTypes.cleaning");
    case "temperature":
      return t("taskTypes.temperature");
    case "other":
      return t("taskTypes.other");
  }
}

function primaryActionLabel(
  task: TodayTaskItem,
  bucket: TodayUiBucket,
  t: ReturnType<typeof useTranslations<"TodayPage">>,
): string {
  const isTemperature = task.type === "temperature";
  const isOverdue = bucket === "overdue";
  const isDueNow = bucket === "dueNow";

  if (isTemperature) {
    if (isDueNow) return t("actions.recordNow");
    return isOverdue ? t("actions.recordLate") : t("actions.record");
  }
  if (isDueNow) return t("actions.completeNow");
  return isOverdue ? t("actions.completeLate") : t("actions.complete");
}

function durationLabel(
  minutes: number,
  direction: "until" | "late",
  t: ReturnType<typeof useTranslations<"TodayPage">>,
): string {
  const absoluteMinutes = Math.max(0, Math.round(Math.abs(minutes)));
  const hours = Math.floor(absoluteMinutes / 60);
  const remainingMinutes = absoluteMinutes % 60;
  const prefix = direction === "until" ? "relative.in" : "relative.lateBy";

  if (hours === 0) {
    return t(`${prefix}Minutes`, { count: remainingMinutes });
  }
  if (remainingMinutes === 0) {
    return t(`${prefix}Hours`, { count: hours });
  }
  return t(`${prefix}HoursMinutes`, {
    hours,
    minutes: remainingMinutes,
  });
}

function formatCompletionTime(timestamp: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const TodayTaskCard = memo(function TodayTaskCard({
  task,
  bucket,
  now,
  isPending,
  currentUserId,
  onComplete,
  onUndo,
  onRecordTemperature,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();

  const status = computeTodayTaskStatus({
    date: task.date,
    scheduledTime: task.scheduledTime,
    now,
    completedAt: task.completedAt,
  });
  const isRecorded = status === "completed";
  const isCompleted = bucket === "completed";
  const isAttention = bucket === "attention";
  const isOverdue = bucket === "overdue";
  const isDueNow = bucket === "dueNow";
  const isTemperature = task.type === "temperature";
  const minutesToTask = minutesUntilScheduled(task.scheduledTime, now);
  const isTaskToday = task.date === localIsoDate(now);

  const statusLabel = (() => {
    if (isAttention) return t("status.attention");
    if (isCompleted) return t("status.completed");
    if (isDueNow) return t("status.now");
    if (isOverdue) {
      return isTaskToday
        ? durationLabel(minutesToTask, "late", t)
        : t("status.overdue");
    }
    return isTaskToday && minutesToTask > 0
      ? durationLabel(minutesToTask, "until", t)
      : t("status.pending");
  })();

  const timeBadgeVariant = (() => {
    if (isAttention || isOverdue) return "destructive" as const;
    if (isDueNow) return "default" as const;
    if (isCompleted) return "secondary" as const;
    return "outline" as const;
  })();

  const resultBadge = (() => {
    if (!isTemperature || !task.temperatureReading) return null;
    return {
      label:
        task.temperatureReading.result === "ok"
          ? t("temperatureDialog.ok")
          : t("temperatureDialog.outOfRange"),
      variant:
        task.temperatureReading.result === "ok"
          ? ("secondary" as const)
          : ("destructive" as const),
      recordedC: task.temperatureReading.recordedC,
      outOfRange: task.temperatureReading.result === "out_of_range",
      correctiveAction: task.temperatureReading.correctiveAction,
    };
  })();

  const typeLabel = taskTypeLabel(task.type, t);
  const subtitle = [task.equipmentName, typeLabel].filter(Boolean).join(" · ");

  const auditLabel =
    task.completedAt && task.completedBy
      ? t("audit.completed", {
          time: formatCompletionTime(task.completedAt, locale),
          user:
            task.completedBy.id === currentUserId
              ? t("audit.you")
              : formatUserName(task.completedBy),
        })
      : null;

  function handlePrimaryAction() {
    if (isRecorded) {
      onUndo(task);
      return;
    }
    if (isTemperature) {
      onRecordTemperature(task);
      return;
    }
    onComplete(task);
  }

  const secondary = (
    <>
      {resultBadge && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              resultBadge.outOfRange
                ? "text-destructive"
                : "text-muted-foreground",
            )}
          >
            {resultBadge.recordedC}°C
          </span>
          <Badge variant={resultBadge.variant}>{resultBadge.label}</Badge>
        </div>
      )}
      {resultBadge?.correctiveAction && (
        <Alert
          variant="destructive"
          className="bg-destructive/5 px-2.5 py-2"
        >
          <CircleAlertIcon className="size-3.5" aria-hidden />
          <AlertDescription className="text-xs leading-relaxed text-foreground!">
            <span className="font-medium">{t("audit.correctiveAction")}:</span>{" "}
            {resultBadge.correctiveAction}
          </AlertDescription>
        </Alert>
      )}
      {auditLabel && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock3Icon className="size-3" aria-hidden />
          <span>{auditLabel}</span>
        </div>
      )}
    </>
  );

  const hasSecondary = resultBadge !== null || auditLabel !== null;

  return (
    <TodayTaskRow
      task={task}
      bucket={bucket}
      statusLabel={statusLabel}
      timeBadgeVariant={timeBadgeVariant}
      subtitle={subtitle}
      actionLabel={
        isRecorded ? t("actions.undo") : primaryActionLabel(task, bucket, t)
      }
      actionVariant={isRecorded ? "outline" : "default"}
      isPending={isPending}
      onAction={handlePrimaryAction}
      secondary={hasSecondary ? secondary : undefined}
    />
  );
}, areTodayTaskCardPropsEqual);

function areTodayTaskCardPropsEqual(prev: Props, next: Props): boolean {
  if (prev.task !== next.task) return false;
  if (prev.bucket !== next.bucket) return false;
  if (prev.isPending !== next.isPending) return false;
  if (prev.currentUserId !== next.currentUserId) return false;
  if (prev.task.completedAt) return true;

  return (
    prev.now.getFullYear() === next.now.getFullYear() &&
    prev.now.getMonth() === next.now.getMonth() &&
    prev.now.getDate() === next.now.getDate() &&
    prev.now.getHours() === next.now.getHours() &&
    prev.now.getMinutes() === next.now.getMinutes()
  );
}
