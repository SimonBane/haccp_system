"use client";

import { CalendarIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  detectRecordsRangePreset,
  RECORDS_RANGE_PRESETS,
  recordsRangeError,
  resolveRecordsPreset,
  type RecordsRangePreset,
} from "@/features/records/lib/date-range";
import { startOfCalendarMonth } from "@haccp/shared";
import { cn } from "@/lib/utils";
import { formatOccurrenceDate } from "@/features/records/lib/format";
import { calendarDateToLocalDate, localTodayDateFromDate } from "@/lib/date";
import type { RecordsDateRange } from "@/features/records/lib/records-grid-config";

/** The picker opens on the month the range ends in, so the selection is always in view. */
function monthOf(dateTo: string): Date {
  return calendarDateToLocalDate(startOfCalendarMonth(dateTo));
}

type RecordsDateRangeControlProps = {
  range: RecordsDateRange;
  today: string;
  onChange: (range: RecordsDateRange) => void;
};

export function RecordsDateRangeControl({
  range,
  today,
  onChange,
}: RecordsDateRangeControlProps) {
  const t = useTranslations("RecordsPage.dateRange");
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  const [month, setMonth] = useState(() => monthOf(range.dateTo));

  const selected = useMemo<DateRange>(
    () =>
      draft ?? {
        from: calendarDateToLocalDate(range.dateFrom),
        to: calendarDateToLocalDate(range.dateTo),
      },
    [draft, range.dateFrom, range.dateTo],
  );

  const activePreset =
    selected.from && selected.to
      ? detectRecordsRangePreset(
          {
            dateFrom: localTodayDateFromDate(selected.from),
            dateTo: localTodayDateFromDate(selected.to),
          },
          today,
        )
      : "custom";

  const selectedError = useMemo(() => {
    if (!selected.from || !selected.to) return draft ? t("incomplete") : null;

    const error = recordsRangeError(
      {
        dateFrom: localTodayDateFromDate(selected.from),
        dateTo: localTodayDateFromDate(selected.to),
      },
      today,
    );

    return error ? t(`error.${error}`) : null;
  }, [draft, selected, t, today]);

  const canApply = Boolean(selected.from && selected.to) && !selectedError;

  const commit = useCallback(
    (next: RecordsDateRange) => {
      setDraft(undefined);
      setOpen(false);
      onChange(next);
    },
    [onChange],
  );

  const handleSelect = useCallback((next: DateRange | undefined) => {
    setDraft(next);
  }, []);

  // A preset only fills the calendar; Apply is what changes the page.
  const handlePreset = useCallback(
    (preset: RecordsRangePreset) => {
      const next = resolveRecordsPreset(preset, today);
      setDraft({
        from: calendarDateToLocalDate(next.dateFrom),
        to: calendarDateToLocalDate(next.dateTo),
      });
      setMonth(monthOf(next.dateTo));
    },
    [today],
  );

  const handleCancel = useCallback(() => {
    setDraft(undefined);
    setOpen(false);
  }, []);

  const handleApply = useCallback(() => {
    if (!selected.from || !selected.to) return;

    const candidate = {
      dateFrom: localTodayDateFromDate(selected.from),
      dateTo: localTodayDateFromDate(selected.to),
    };

    if (recordsRangeError(candidate, today)) return;

    commit(candidate);
  }, [commit, selected, today]);

  const label = `${formatOccurrenceDate(range.dateFrom)} - ${formatOccurrenceDate(range.dateTo)}`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDraft(undefined);
        else setMonth(monthOf(range.dateTo));
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={isMobile ? "lg" : "sm"}
            className={cn(
              "w-full justify-start bg-card sm:w-auto",
              isMobile ? "h-11" : "h-9",
            )}
            aria-label={t("label")}
          />
        }
      >
        <CalendarIcon />
        <span className="truncate">{label}</span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "gap-0 p-0",
          isMobile ? "w-(--anchor-width)" : "w-auto",
        )}
      >
        <div className="flex flex-col">
          <div className="flex gap-1 border-b p-2">
            {RECORDS_RANGE_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={activePreset === preset ? "secondary" : "ghost"}
                size={isMobile ? "lg" : "sm"}
                className={cn("flex-1", isMobile ? "h-11" : "h-9")}
                onClick={() => handlePreset(preset)}
              >
                {t(`presets.${preset}`)}
              </Button>
            ))}
          </div>

          <div className="flex min-w-0 flex-col">
            <Calendar
              mode="range"
              autoFocus
              month={month}
              onMonthChange={setMonth}
              endMonth={calendarDateToLocalDate(today)}
              // A phone stretches the month across the card but keeps day cells at a normal height.
              className={cn(
                isMobile &&
                  "w-full [&_td]:aspect-auto [&_td]:h-9 [&_td_button]:aspect-auto [&_td_button]:h-9",
              )}
              classNames={
                isMobile ? { root: "w-full", week: "mt-1 flex w-full" } : undefined
              }
              selected={selected}
              onSelect={handleSelect}
              // A crafted request is rejected by the API too; this stops the mistake earlier.
              disabled={{ after: calendarDateToLocalDate(today) }}
            />
            <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
              <p role="alert" className="text-xs text-destructive">
                {selectedError}
              </p>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!canApply}
                  onClick={handleApply}
                >
                  {t("apply")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
