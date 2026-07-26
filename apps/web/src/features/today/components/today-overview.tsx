"use client";

import type { TodayTaskItem } from "@haccp/shared";
import {
  CheckCircle2Icon,
  CircleAlertIcon,
  ListChecksIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ThermometerIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { type GroupedTodayTasks, occurrenceKey } from "../lib/today-grouping";

type Props = {
  grouped: GroupedTodayTasks;
};

function allGroupedTasks(grouped: GroupedTodayTasks): TodayTaskItem[] {
  return [
    ...grouped.attention,
    ...grouped.overdue,
    ...grouped.dueNow,
    ...grouped.upcoming,
    ...grouped.completed,
  ];
}

function latestRecordedTasks(grouped: GroupedTodayTasks): TodayTaskItem[] {
  return [...grouped.attention, ...grouped.completed]
    .filter((task) => task.completedAt)
    .sort(
      (a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
    )
    .slice(0, 4);
}

export function TodayOverview({ grouped }: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();
  const tasks = allGroupedTasks(grouped);
  const exceptionTasks = [...grouped.attention, ...grouped.overdue];
  const needsAttention = exceptionTasks.length > 0;
  const temperatureTasks = tasks.filter((task) => task.type === "temperature");
  const temperatureRecorded = temperatureTasks.filter(
    (task) => task.temperatureReading,
  ).length;
  const temperatureIssues = temperatureTasks.filter(
    (task) => task.temperatureReading?.result === "out_of_range",
  ).length;
  const temperatureDue = temperatureTasks.length - temperatureRecorded;
  const recentTasks = latestRecordedTasks(grouped);

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-xs min-[1400px]:sticky min-[1400px]:top-6">
      <CardHeader className="border-b bg-muted/20 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg",
                needsAttention
                  ? "bg-destructive/10 text-destructive"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
              )}
            >
              {needsAttention ? (
                <CircleAlertIcon className="size-4" aria-hidden />
              ) : (
                <ShieldCheckIcon className="size-4" aria-hidden />
              )}
            </div>
            <div className="min-w-0">
              <CardTitle>{t("overview.title")}</CardTitle>
              <CardDescription className="mt-1 text-xs">
                {t("overview.description")}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant={needsAttention ? "destructive" : "secondary"}
            className="shrink-0"
          >
            {needsAttention
              ? t("overview.needsAttention")
              : t("overview.onTrack")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 px-5 py-5">
        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section aria-labelledby="today-exceptions-title">
            <div
              id="today-exceptions-title"
              className="mb-2.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              <CircleAlertIcon className="size-3.5" aria-hidden />
              {t("overview.exceptions")}
            </div>

            {exceptionTasks.length > 0 ? (
              <div className="space-y-2">
                {exceptionTasks.slice(0, 3).map((task) => {
                  const isTemperatureIssue =
                    task.temperatureReading?.result === "out_of_range";

                  return (
                    <div
                      key={occurrenceKey(task)}
                      className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.025] p-3"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                        <CircleAlertIcon className="size-3.5" aria-hidden />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {task.title}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {task.equipmentName ?? t(`taskTypes.${task.type}`)}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <time
                          dateTime={task.scheduledTime}
                          className="text-xs font-semibold tabular-nums"
                        >
                          {task.scheduledTime}
                        </time>
                        <Badge
                          variant="destructive"
                          className="max-w-28 text-[10px]"
                        >
                          <span className="truncate">
                            {isTemperatureIssue
                              ? t("temperatureDialog.outOfRange")
                              : t("status.overdue")}
                          </span>
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border bg-emerald-500/[0.04] p-3.5 text-sm">
                <ShieldCheckIcon
                  className="size-4 text-emerald-700 dark:text-emerald-400"
                  aria-hidden
                />
                <span>{t("overview.noExceptions")}</span>
              </div>
            )}
          </section>

          {temperatureTasks.length > 0 && (
            <section aria-labelledby="today-temperature-title">
              <div
                id="today-temperature-title"
                className="mb-2.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                <ThermometerIcon className="size-3.5" aria-hidden />
                {t("overview.temperatureChecks")}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <OverviewMetric
                  icon={ListChecksIcon}
                  value={temperatureDue}
                  label={t("overview.temperatureDue")}
                />
                <OverviewMetric
                  icon={CheckCircle2Icon}
                  value={temperatureRecorded}
                  label={t("overview.temperatureRecorded")}
                />
                <OverviewMetric
                  icon={CircleAlertIcon}
                  value={temperatureIssues}
                  label={t("overview.temperatureIssues")}
                  urgent={temperatureIssues > 0}
                />
              </div>
            </section>
          )}
        </div>

        <Separator />

        <section aria-labelledby="today-activity-title">
          <div
            id="today-activity-title"
            className="mb-2.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            <SparklesIcon className="size-3.5" aria-hidden />
            {t("overview.latestActivity")}
          </div>
          {recentTasks.length > 0 ? (
            <div className="grid gap-2 2xl:grid-cols-2">
              {recentTasks.map((task) => (
                <div
                  key={occurrenceKey(task)}
                  className="flex items-start justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate">{task.title}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {task.equipmentName ?? t(`taskTypes.${task.type}`)}
                    </div>
                  </div>
                  <time
                    dateTime={task.completedAt!}
                    className="shrink-0 font-medium tabular-nums"
                  >
                    {new Intl.DateTimeFormat(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(task.completedAt!))}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("overview.noRecentActivity")}
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

type MetricProps = {
  icon: typeof CircleAlertIcon;
  value: number;
  label: string;
  urgent?: boolean;
};

function OverviewMetric({ icon: Icon, value, label, urgent }: MetricProps) {
  return (
    <div className="min-w-0 rounded-xl border bg-background p-2.5 text-center">
      <div
        className={cn(
          "mx-auto mb-1.5 flex size-7 items-center justify-center rounded-lg",
          urgent
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </div>
      <div
        className={cn(
          "text-lg font-semibold tabular-nums",
          urgent && "text-destructive",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
