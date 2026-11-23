"use client";

import { addCalendarDays } from "@haccp/shared";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { calendarDateToLocalDate, localTodayDateFromDate } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  formatDayMonth,
  formatWeekdayDayMonth,
  relativeDay,
} from "../lib/format";

/** "Today, Nov 23" near today; "Fri, Nov 20" further out. */
export function useDayLabel(date: string, todayDate: string): string {
  const t = useTranslations("TodayPage");
  const locale = useLocale();
  const relative = relativeDay(date, todayDate);
  if (!relative) return formatWeekdayDayMonth(date, locale);

  return t("dateNavigation.relativeDate", {
    day: relative === "today" ? t("title") : t(`day.${relative}`),
    date: formatDayMonth(date, locale),
  });
}

type StepProps = {
  direction: "previous" | "next";
  date: string;
  onChange: (date: string) => void;
  className?: string;
};

export function DayStepButton({
  direction,
  date,
  onChange,
  className,
}: StepProps) {
  const t = useTranslations("TodayPage.dateNavigation");
  const Icon = direction === "previous" ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={className}
      aria-label={t(direction)}
      data-testid={`date-nav-${direction}`}
      onClick={() =>
        onChange(addCalendarDays(date, direction === "previous" ? -1 : 1))
      }
    >
      <Icon />
    </Button>
  );
}

type PickerProps = {
  date: string;
  todayDate: string;
  onChange: (date: string) => void;
  align?: "start" | "center";
  /** Shown after the label, inside the trigger. */
  suffix?: ReactNode;
  className?: string;
};

/** The day's name opens a month to jump further. */
export function DayPicker({
  date,
  todayDate,
  onChange,
  align = "start",
  suffix,
  className,
}: PickerProps) {
  const t = useTranslations("TodayPage.dateNavigation");
  const label = useDayLabel(date, todayDate);
  const [open, setOpen] = useState(false);

  function pick(next: string) {
    setOpen(false);
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            className={cn("min-w-0 px-2", className)}
            data-testid="date-nav-trigger"
          />
        }
      >
        <span className="truncate">{label}</span>
        {suffix}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-auto gap-2 p-2">
        <Calendar
          mode="single"
          autoFocus
          defaultMonth={calendarDateToLocalDate(date)}
          selected={calendarDateToLocalDate(date)}
          onSelect={(selected) => {
            if (selected) pick(localTodayDateFromDate(selected));
          }}
        />
        {date !== todayDate ? (
          <Button
            variant="secondary"
            size="sm"
            data-testid="date-nav-today"
            onClick={() => pick(todayDate)}
          >
            {t("today")}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
