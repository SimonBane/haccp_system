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
import { formatOccurrenceDate } from "@/features/records/lib/format";
import type { RecordsDateRange } from "@/features/records/lib/records-grid-config";

/** The picker is a widget: dates stay canonical strings, only the UI uses `Date`. */
function toPickerDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

function fromPickerDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

  const activePreset = detectRecordsRangePreset(range, today);
  const selected = useMemo<DateRange>(
    () =>
      draft ?? {
        from: toPickerDate(range.dateFrom),
        to: toPickerDate(range.dateTo),
      },
    [draft, range.dateFrom, range.dateTo],
  );

  const selectedError = useMemo(() => {
    if (!selected.from || !selected.to) return draft ? t("incomplete") : null;

    const error = recordsRangeError(
      {
        dateFrom: fromPickerDate(selected.from),
        dateTo: fromPickerDate(selected.to),
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

  const handlePreset = useCallback(
    (preset: RecordsRangePreset) => commit(resolveRecordsPreset(preset, today)),
    [commit, today],
  );

  const handleCancel = useCallback(() => {
    setDraft(undefined);
    setOpen(false);
  }, []);

  const handleApply = useCallback(() => {
    if (!selected.from || !selected.to) return;

    const candidate = {
      dateFrom: fromPickerDate(selected.from),
      dateTo: fromPickerDate(selected.to),
    };

    if (recordsRangeError(candidate, today)) return;

    commit(candidate);
  }, [commit, selected, today]);

  const label = `${formatOccurrenceDate(range.dateFrom)} – ${formatOccurrenceDate(range.dateTo)}`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setDraft(undefined);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full justify-start bg-card sm:w-auto"
            aria-label={t("label")}
          />
        }
      >
        <CalendarIcon />
        <span className="truncate">{label}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto max-w-[92vw] p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex flex-row flex-wrap gap-1 border-b p-2 sm:w-44 sm:flex-col sm:border-r sm:border-b-0">
            {RECORDS_RANGE_PRESETS.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant={activePreset === preset ? "secondary" : "ghost"}
                size="sm"
                className="h-9 justify-start"
                onClick={() => handlePreset(preset)}
              >
                {t(`presets.${preset}`)}
              </Button>
            ))}
          </div>

          <div className="flex flex-col">
            <Calendar
              mode="range"
              autoFocus
              numberOfMonths={isMobile ? 1 : 2}
              endMonth={toPickerDate(range.dateTo)}
              selected={selected}
              onSelect={handleSelect}
              // A crafted request is rejected by the API too; this stops the mistake earlier.
              disabled={{ after: toPickerDate(today) }}
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
