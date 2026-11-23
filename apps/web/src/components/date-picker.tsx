"use client";

import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  calendarDateToLocalDate,
  formatNumericDate,
  localTodayDateFromDate,
} from "@/lib/date";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  id?: string;
  /** "YYYY-MM-DD", or "" when nothing is picked. */
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  invalid?: boolean;
  /** Shown when set and a date is picked, so an optional date can be emptied again. */
  clearLabel?: string;
};

/** The shared Calendar on desktop; phones keep their own date wheel, which suits touch better. */
export function DatePicker({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  clearLabel,
}: DatePickerProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const selected = value ? calendarDateToLocalDate(value) : undefined;

  if (isMobile) {
    return (
      <Input
        id={id}
        type="date"
        value={value}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  function pick(next: string) {
    setOpen(false);
    onChange(next);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={invalid}
            className={cn(
              "h-(--control-h) w-full justify-start font-normal tabular-nums",
              !value && "text-muted-foreground",
            )}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" />
        {value ? formatNumericDate(value) : placeholder}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto gap-2 p-2">
        <Calendar
          mode="single"
          autoFocus
          defaultMonth={selected}
          selected={selected}
          onSelect={(date) => {
            if (date) pick(localTodayDateFromDate(date));
          }}
        />
        {value && clearLabel ? (
          <Button variant="ghost" size="sm" onClick={() => pick("")}>
            {clearLabel}
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
