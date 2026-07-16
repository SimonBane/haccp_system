"use client";

import {
  TASK_TEMPLATE_HOURS,
  TASK_TEMPLATE_MINUTES,
  composeScheduledTime,
  type TaskTemplateMinute,
} from "@haccp/shared";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ScheduledTimeRowProps = {
  hour: string;
  minute: string;
  onHourChange: (hour: string) => void;
  onMinuteChange: (minute: string) => void;
  onRemove: () => void;
  canRemove: boolean;
  defaultOpen?: boolean;
};

function scrollListToValue(container: HTMLDivElement, value: string) {
  const selectedEl = container.querySelector<HTMLElement>(
    `[data-time-value="${value}"]`,
  );
  if (!selectedEl) return;

  container.scrollTop =
    selectedEl.offsetTop -
    container.clientHeight / 2 +
    selectedEl.clientHeight / 2;
}

type TimePickerColumnProps = {
  values: readonly string[];
  selected: string;
  open: boolean;
  onSelect: (value: string) => void;
};

function TimePickerColumn({
  values,
  selected,
  open,
  onSelect,
}: TimePickerColumnProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) return;

    const scroll = () => {
      if (listRef.current) {
        scrollListToValue(listRef.current, selected);
      }
    };

    scroll();
    const raf = requestAnimationFrame(() => {
      scroll();
      requestAnimationFrame(scroll);
    });
    const timeoutId = window.setTimeout(scroll, 150);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timeoutId);
    };
  }, [open, selected]);

  return (
    <div className="flex min-w-16 flex-col">
      <div
        ref={listRef}
        className="max-h-48 overflow-y-auto p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {values.map((value) => (
          <button
            key={value}
            data-time-value={value}
            type="button"
            className={cn(
              "flex w-full cursor-pointer items-center justify-center rounded-sm px-3 py-1.5 text-sm transition-colors",
              selected === value
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
            aria-pressed={selected === value}
            onClick={() => onSelect(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ScheduledTimeRow({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  onRemove,
  canRemove,
  defaultOpen = false,
}: ScheduledTimeRowProps) {
  const t = useTranslations("TasksPage");
  const timeLabel = composeScheduledTime(hour, minute);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!defaultOpen) return;

    // Defer opening so the Add time click doesn't count as an outside close.
    const timeoutId = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, [defaultOpen]);

  return (
    <div className="group relative w-full min-w-0 flex-1">
      {canRemove ? (
        <button
          type="button"
          aria-label={t("removeTime")}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
          className={cn(
            "absolute top-1/2 right-2 z-10 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground",
            "opacity-100 transition-opacity",
            "sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          )}
        >
          <XIcon className="size-3.5" />
        </button>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="default"
              className={cn(
                "w-full min-w-0 justify-start px-2.5 font-normal",
                canRemove && "pr-7",
              )}
            />
          }
        >
          <span className="truncate">{timeLabel}</span>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto gap-0 p-0"
          initialFocus={false}
        >
          <div className="flex divide-x">
            <TimePickerColumn
              values={TASK_TEMPLATE_HOURS}
              selected={hour}
              open={open}
              onSelect={onHourChange}
            />
            <TimePickerColumn
              values={TASK_TEMPLATE_MINUTES}
              selected={minute}
              open={open}
              onSelect={(value) => onMinuteChange(value as TaskTemplateMinute)}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
