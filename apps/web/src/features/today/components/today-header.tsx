"use client";

import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ListTodoIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  dateLabel: string;
  completed: number;
  total: number;
  remaining: number;
  attention: number;
  isToday: boolean;
  onPreviousDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
};

export function TodayHeader({
  title,
  dateLabel,
  completed,
  total,
  remaining,
  attention,
  isToday,
  onPreviousDay,
  onToday,
  onNextDay,
}: Props) {
  const t = useTranslations("TodayPage");
  const progressValue = total > 0 ? Math.round((completed / total) * 100) : 0;
  const summary = t("progress.summary", { completed, total });

  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>

        <ButtonGroup
          className="w-full sm:w-fit"
          aria-label={t("dateNavigation.ariaLabel")}
        >
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onPreviousDay}
            aria-label={t("dateNavigation.previous")}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "min-w-0 flex-1 px-3 sm:flex-none",
              isToday && "bg-muted",
            )}
            onClick={onToday}
            disabled={isToday}
          >
            <CalendarDaysIcon data-icon="inline-start" />
            {t("dateNavigation.today")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onNextDay}
            aria-label={t("dateNavigation.next")}
          >
            <ChevronRightIcon />
          </Button>
        </ButtonGroup>
      </div>

      {total > 0 && (
        <Card className="gap-0 py-0 shadow-xs xl:hidden">
          <div className="grid grid-cols-3 divide-x">
            <div className="flex min-w-0 items-center gap-2.5 p-3 sm:px-4">
              <div
                className={cn(
                  "hidden size-8 shrink-0 items-center justify-center rounded-lg sm:flex",
                  attention > 0
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <CircleAlertIcon className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold tabular-nums leading-none">
                  {attention}
                </div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">
                  {t("metrics.attention")}
                </div>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2.5 p-3 sm:px-4">
              <div className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
                <ListTodoIcon className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold tabular-nums leading-none">
                  {remaining}
                </div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">
                  {t("metrics.remaining")}
                </div>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-2.5 p-3 sm:px-4">
              <div className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
                <ShieldCheckIcon className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold tabular-nums leading-none">
                  {completed}/{total}
                </div>
                <div className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">
                  {t("metrics.completed")}
                </div>
              </div>
            </div>
          </div>
          <div className="border-t px-3 py-2.5 sm:px-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">
                {t("progress.label")}
              </span>
              <span className="font-medium tabular-nums">{summary}</span>
            </div>
            <Progress
              value={progressValue}
              aria-label={t("progress.label")}
              aria-valuetext={summary}
              className="w-full gap-0"
            />
          </div>
        </Card>
      )}
    </header>
  );
}
