"use client";

import type { TodayTaskItem } from "@haccp/shared";
import { computeTodayTaskStatus } from "@haccp/shared";
import {
  CheckIcon,
  CircleAlertIcon,
  Clock3Icon,
  ThermometerIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { memo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { minutesUntilScheduled, type TodayUiBucket } from "../lib/today-grouping";

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

  if (isTemperature) {
    return isOverdue ? t("actions.recordLate") : t("actions.record");
  }
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

  const statusBadge = (() => {
    if (isAttention) {
      return {
        label: t("status.attention"),
        variant: "destructive" as const,
        showCheck: false,
      };
    }
    if (isCompleted) {
      return {
        label: t("status.completed"),
        variant: "secondary" as const,
        showCheck: true,
      };
    }
    if (isDueNow) {
      return {
        label: t("status.now"),
        variant: "default" as const,
        showCheck: false,
      };
    }
    if (isOverdue) {
      return {
        label: isTaskToday
          ? durationLabel(minutesToTask, "late", t)
          : t("status.overdue"),
        variant: "destructive" as const,
        showCheck: false,
      };
    }
    return {
      label:
        isTaskToday && minutesToTask > 0
          ? durationLabel(minutesToTask, "until", t)
          : t("status.pending"),
      variant: "outline" as const,
      showCheck: false,
    };
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

  const showAllowedRange =
    isTemperature &&
    task.minTempC !== null &&
    task.maxTempC !== null &&
    (!isRecorded || resultBadge?.outOfRange);

  const typeLabel = taskTypeLabel(task.type, t);
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

  const taskDetails = (
    <>
      <div
        className={cn(
          "text-sm font-medium leading-snug",
          isCompleted && "text-foreground/80",
        )}
      >
        {task.title}
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-snug text-muted-foreground">
        <span>
          {[task.equipmentName, typeLabel].filter(Boolean).join(" · ")}
        </span>
        {showAllowedRange && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <ThermometerIcon className="size-3" aria-hidden />
            {t("allowedRangeCompact", {
              min: task.minTempC!,
              max: task.maxTempC!,
            })}
          </span>
        )}
      </div>
      {resultBadge && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
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
          className="mt-1.5 bg-destructive/5 px-2.5 py-2"
        >
          <CircleAlertIcon className="size-3.5" aria-hidden />
          <AlertDescription className="text-xs leading-relaxed text-foreground!">
            <span className="font-medium">{t("audit.correctiveAction")}:</span>{" "}
            {resultBadge.correctiveAction}
          </AlertDescription>
        </Alert>
      )}
      {auditLabel && (
        <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <Clock3Icon className="size-3" aria-hidden />
          <span>{auditLabel}</span>
        </div>
      )}
    </>
  );

  return (
    <Card
      size="sm"
      className={cn(
        "gap-0 py-0 shadow-none transition-all hover:bg-muted/25 hover:shadow-xs focus-within:ring-2 focus-within:ring-ring/40",
        isAttention &&
          "border-l-[3px] border-l-destructive bg-destructive/[0.025]",
        isOverdue && "border-l-[3px] border-l-destructive",
        isDueNow && "border-l-[3px] border-l-primary bg-primary/[0.025]",
        isCompleted && "bg-muted/10",
      )}
    >
      <div className="hidden items-stretch gap-4 p-3.5 md:flex">
        <div
          className={cn(
            "flex w-20 shrink-0 flex-col items-center justify-center rounded-lg bg-muted/60 px-2 py-3",
            isAttention && "bg-destructive/8",
            isDueNow && "bg-primary/8",
          )}
        >
          <Clock3Icon
            className="mb-1.5 size-3.5 text-muted-foreground"
            aria-hidden
          />
          <time
            dateTime={task.scheduledTime}
            className={cn(
              "text-base font-semibold tabular-nums tracking-tight",
              isCompleted && "text-muted-foreground",
            )}
          >
            {task.scheduledTime}
          </time>
        </div>

        <div className="flex min-w-0 flex-1 items-center">
          <div className="min-w-0">{taskDetails}</div>
        </div>

        <div className="flex w-28 shrink-0 flex-col items-stretch justify-center gap-2">
          <Badge
            variant={statusBadge.variant}
            className="max-w-full justify-center gap-1 text-[11px]"
          >
            {statusBadge.showCheck && <CheckIcon aria-hidden />}
            <span className="truncate">{statusBadge.label}</span>
          </Badge>

          <Button
            type="button"
            variant={isRecorded ? "outline" : "default"}
            size="sm"
            className={cn(
              "w-full",
              isRecorded && "text-muted-foreground hover:text-foreground",
            )}
            isLoading={isPending}
            onClick={handlePrimaryAction}
          >
            {isRecorded
              ? t("actions.undo")
              : primaryActionLabel(task, bucket, t)}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-3.5 py-3.5 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <time
            dateTime={task.scheduledTime}
            className={cn(
              "text-base font-semibold tabular-nums tracking-tight",
              isCompleted && "text-muted-foreground",
            )}
          >
            {task.scheduledTime}
          </time>
          <Badge variant={statusBadge.variant} className="gap-1 text-[11px]">
            {statusBadge.showCheck && <CheckIcon aria-hidden />}
            {statusBadge.label}
          </Badge>
        </div>

        <div className="min-w-0">{taskDetails}</div>

        <Button
          type="button"
          variant={isRecorded ? "outline" : "default"}
          size="lg"
          className="h-11 w-full"
          isLoading={isPending}
          onClick={handlePrimaryAction}
        >
          {isRecorded ? t("actions.undo") : primaryActionLabel(task, bucket, t)}
        </Button>
      </div>
    </Card>
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
