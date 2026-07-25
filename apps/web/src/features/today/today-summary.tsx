"use client";

import type { TodayTaskItem } from "@haccp/shared";
import {
  CalendarClockIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
  ListTodoIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { TodayFilter } from "./today-grouping";
import { minutesUntilScheduled } from "./today-grouping";

type Props = {
  completed: number;
  total: number;
  remaining: number;
  attention: number;
  nextTask: TodayTaskItem | null;
  now: Date;
  onFilterChange: (filter: TodayFilter) => void;
};

function durationLabel(
  minutes: number,
  t: ReturnType<typeof useTranslations<"TodayPage">>,
): string {
  const absoluteMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(absoluteMinutes / 60);
  const remainingMinutes = absoluteMinutes % 60;

  if (hours === 0) {
    return t("relative.inMinutes", { count: remainingMinutes });
  }
  if (remainingMinutes === 0) {
    return t("relative.inHours", { count: hours });
  }
  return t("relative.inHoursMinutes", {
    hours,
    minutes: remainingMinutes,
  });
}

export function TodaySummary({
  completed,
  total,
  remaining,
  attention,
  nextTask,
  now,
  onFilterChange,
}: Props) {
  const t = useTranslations("TodayPage");
  const progressValue = total > 0 ? Math.round((completed / total) * 100) : 0;
  const progressSummary = t("progress.summary", { completed, total });
  const minutesToNext = nextTask
    ? minutesUntilScheduled(nextTask.scheduledTime, now)
    : null;

  return (
    <section
      className="hidden grid-cols-4 gap-3 xl:grid"
      aria-label={t("summary.ariaLabel")}
    >
      <Card className="gap-0 py-0">
        <Button
          type="button"
          variant="ghost"
          className="h-full min-h-24 w-full justify-start rounded-xl px-4 py-3 text-left"
          onClick={() => onFilterChange("completed")}
        >
          <div className="flex w-full min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2Icon className="size-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xl font-semibold tracking-tight tabular-nums">
                  {completed}/{total}
                </span>
                <span className="text-xs font-semibold tabular-nums">
                  {progressValue}%
                </span>
              </div>
              <div className="mt-0.5 text-xs font-normal text-muted-foreground">
                {t("progress.label")}
              </div>
              <Progress
                value={progressValue}
                aria-label={t("progress.label")}
                aria-valuetext={progressSummary}
                className="mt-2"
              />
            </div>
          </div>
        </Button>
      </Card>

      <SummaryMetric
        icon={CircleAlertIcon}
        value={attention}
        label={t("metrics.attention")}
        detail={
          attention > 0 ? t("summary.requiresAction") : t("overview.onTrack")
        }
        urgent={attention > 0}
        onClick={() => onFilterChange("attention")}
      />

      <SummaryMetric
        icon={ListTodoIcon}
        value={remaining}
        label={t("metrics.remaining")}
        detail={t("summary.tasksLeft")}
        onClick={() => onFilterChange("todo")}
      />

      <Card className="gap-0 py-0">
        <Button
          type="button"
          variant="ghost"
          className="h-full min-h-24 w-full justify-start rounded-xl px-4 py-3 text-left"
          onClick={() => onFilterChange("todo")}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarClockIcon className="size-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-normal text-muted-foreground">
                {t("summary.nextDeadline")}
              </div>
              {nextTask ? (
                <>
                  <div className="mt-1 flex items-baseline gap-2">
                    <time
                      dateTime={nextTask.scheduledTime}
                      className="text-xl font-semibold tracking-tight tabular-nums"
                    >
                      {nextTask.scheduledTime}
                    </time>
                    {minutesToNext !== null && minutesToNext >= 0 && (
                      <span className="truncate text-xs font-normal text-muted-foreground">
                        {durationLabel(minutesToNext, t)}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
                    {nextTask.title}
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm font-medium">
                  {t("summary.noDeadline")}
                </div>
              )}
            </div>
          </div>
        </Button>
      </Card>
    </section>
  );
}

type SummaryMetricProps = {
  icon: typeof CircleAlertIcon;
  value: number;
  label: string;
  detail: string;
  urgent?: boolean;
  onClick: () => void;
};

function SummaryMetric({
  icon: Icon,
  value,
  label,
  detail,
  urgent,
  onClick,
}: SummaryMetricProps) {
  return (
    <Card className="gap-0 py-0">
      <Button
        type="button"
        variant="ghost"
        className="h-full min-h-24 w-full justify-start rounded-xl px-4 py-3 text-left"
        onClick={onClick}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              urgent
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <div
              className={cn(
                "text-xl font-semibold tracking-tight tabular-nums",
                urgent && "text-destructive",
              )}
            >
              {value}
            </div>
            <div className="text-xs font-normal text-muted-foreground">
              {label}
            </div>
            <div className="mt-0.5 truncate text-xs font-normal text-muted-foreground/80">
              {detail}
            </div>
          </div>
        </div>
      </Button>
    </Card>
  );
}
