"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  dateLabel: string;
  isToday: boolean;
  onPreviousDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
};

export function TodayHeader({
  title,
  dateLabel,
  isToday,
  onPreviousDay,
  onToday,
  onNextDay,
}: Props) {
  const t = useTranslations("TodayPage");

  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          <p className="hidden text-sm text-muted-foreground sm:block">
            {dateLabel}
          </p>
        </div>

        <div
          className="flex w-full items-center gap-1 sm:w-fit"
          aria-label={t("dateNavigation.ariaLabel")}
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 sm:size-9"
            onClick={onPreviousDay}
            aria-label={t("dateNavigation.previous")}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "min-h-11 min-w-0 flex-1 px-3 text-sm font-medium sm:min-h-9 sm:flex-none",
              !isToday && "hover:bg-accent",
            )}
            onClick={isToday ? undefined : onToday}
            disabled={isToday}
            aria-label={isToday ? dateLabel : t("dateNavigation.jumpToToday")}
          >
            {dateLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0 sm:size-9"
            onClick={onNextDay}
            aria-label={t("dateNavigation.next")}
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </header>
  );
}
