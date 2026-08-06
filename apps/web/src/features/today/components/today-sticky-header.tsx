"use client";

import {
  CalendarDaysIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ThermometerIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  MobileHeaderActions,
  MobileHeaderCenter,
  MobileHeaderTitle,
} from "@/components/layout/mobile-header-slot";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatShortDate } from "../lib/format";
import { scrollToTimeGroup } from "../lib/scroll";
import type { TodayTimeline } from "../lib/today-timeline";

type Props = {
  timeline: TodayTimeline;
  selectedDate: string;
  dateLabel: string;
  isToday: boolean;
  onPreviousDay: () => void;
  onToday: () => void;
  onNextDay: () => void;
};

function JumpChips({ timeline }: { timeline: TodayTimeline }) {
  const t = useTranslations("TodayPage");

  const chipClassName =
    "h-7 gap-1 rounded-full bg-destructive/10 px-2 text-xs text-destructive hover:bg-destructive/20 dark:bg-destructive/20";

  return (
    <>
      {timeline.overdueCount > 0 && timeline.firstOverdueGroupId ? (
        <Button
          variant="ghost"
          size="sm"
          className={chipClassName}
          aria-label={t("timeline.jumpToOverdue", {
            count: timeline.overdueCount,
          })}
          onClick={() =>
            scrollToTimeGroup(timeline.firstOverdueGroupId as string)
          }
        >
          <CircleAlertIcon className="size-3.5" />
          {timeline.overdueCount}
        </Button>
      ) : null}

      {timeline.deviationCount > 0 && timeline.firstDeviationGroupId ? (
        <Button
          variant="ghost"
          size="sm"
          className={chipClassName}
          aria-label={t("timeline.jumpToDeviation", {
            count: timeline.deviationCount,
          })}
          onClick={() =>
            scrollToTimeGroup(timeline.firstDeviationGroupId as string)
          }
        >
          <ThermometerIcon className="size-3.5" />
          {timeline.deviationCount}
        </Button>
      ) : null}
    </>
  );
}

/**
 * Bar and count are one unit: a tracked, rounded bar sitting right next to its
 * own numbers reads as progress, where a full-width line on the header edge
 * just read as a second separator.
 */
function ProgressMeter({
  timeline,
  barClassName,
}: {
  timeline: TodayTimeline;
  barClassName: string;
}) {
  const t = useTranslations("TodayPage");

  if (timeline.total === 0) {
    return null;
  }

  const percent = Math.round((timeline.completedCount / timeline.total) * 100);

  return (
    <div className="flex items-center gap-2">
      <Progress
        value={percent}
        aria-label={t("progress.summary", {
          completed: timeline.completedCount,
          total: timeline.total,
        })}
        className={cn(
          "gap-0",
          "[&_[data-slot=progress-track]]:h-2",
          "[&_[data-slot=progress-indicator]]:rounded-full",
          timeline.isAllDone &&
            "[&_[data-slot=progress-indicator]]:bg-success",
          barClassName,
        )}
      />
      <span className="text-sm font-medium tabular-nums">
        <span
          className={timeline.isAllDone ? "text-success" : "text-foreground"}
        >
          {timeline.completedCount}
        </span>
        <span className="text-muted-foreground">/{timeline.total}</span>
      </span>
    </div>
  );
}

function DateNavigation({
  dateLabel,
  isToday,
  onPreviousDay,
  onToday,
  onNextDay,
}: Omit<Props, "timeline" | "selectedDate">) {
  const t = useTranslations("TodayPage");

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1 px-1.5 text-muted-foreground"
            aria-label={t("dateNavigation.ariaLabel")}
          />
        }
      >
        <CalendarDaysIcon />
        <ChevronDownIcon className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto gap-2 p-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("dateNavigation.previous")}
            onClick={onPreviousDay}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-44 px-1 text-center text-sm font-medium">
            {dateLabel}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("dateNavigation.next")}
            onClick={onNextDay}
          >
            <ChevronRightIcon />
          </Button>
        </div>
        {!isToday ? (
          <Button variant="secondary" size="sm" onClick={onToday}>
            {t("dateNavigation.jumpToToday")}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function TodayStickyHeader({
  timeline,
  selectedDate,
  dateLabel,
  isToday,
  onPreviousDay,
  onToday,
  onNextDay,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();
  const isMobile = useIsMobile();

  const title = isToday ? t("title") : formatShortDate(selectedDate, locale);
  const dateNavigation = (
    <DateNavigation
      dateLabel={dateLabel}
      isToday={isToday}
      onPreviousDay={onPreviousDay}
      onToday={onToday}
      onNextDay={onNextDay}
    />
  );

  // On mobile this page has no header of its own: its title, progress and date
  // controls live in the shared top bar next to the drawer trigger.
  if (isMobile) {
    return (
      <>
        <MobileHeaderTitle>{title}</MobileHeaderTitle>
        <MobileHeaderCenter>
          <JumpChips timeline={timeline} />
          <ProgressMeter timeline={timeline} barClassName="w-14" />
        </MobileHeaderCenter>
        <MobileHeaderActions>{dateNavigation}</MobileHeaderActions>
      </>
    );
  }

  return (
    // md:top-2 matches the m-2 inset card SidebarInset renders on desktop, so
    // the bar pins flush with the card edge instead of floating above it.
    <header className="sticky top-2 z-30 rounded-t-xl bg-background backdrop-blur-xl supports-[backdrop-filter]:bg-background/85">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5">
          <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight sm:text-xl">
            {title}
          </h1>

          <div className="flex items-center justify-center gap-1.5">
            <JumpChips timeline={timeline} />
            <ProgressMeter timeline={timeline} barClassName="w-36" />
          </div>

          <div className="flex justify-end">{dateNavigation}</div>
        </div>
      </div>
      <div
        aria-hidden
        className="h-px bg-[linear-gradient(90deg,transparent_0%,var(--border)_6%,var(--border)_94%,transparent_100%)]"
      />
    </header>
  );
}
