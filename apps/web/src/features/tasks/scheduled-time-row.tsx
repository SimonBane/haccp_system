"use client";

import { normalizeScheduledTimeInput } from "@haccp/shared";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function toTimeInputValue(time: string): string {
  if (!time) return "";

  const normalized = normalizeScheduledTimeInput(time);
  return normalized ?? time;
}

function fromTimeInputValue(input: string): string {
  if (!input) return "";

  const [hour, minute] = input.split(":");
  if (!hour || minute === undefined) return input;

  const normalized = normalizeScheduledTimeInput(`${hour}:${minute}`);
  return normalized ?? input;
}

type ScheduledTimeRowProps = {
  id?: string;
  value: string;
  onChange: (time: string) => void;
  onBlur: () => void;
  onRemove: () => void;
  canRemove: boolean;
  autoFocus?: boolean;
  "aria-invalid"?: boolean;
};

export function ScheduledTimeRow({
  id,
  value,
  onChange,
  onBlur,
  onRemove,
  canRemove,
  autoFocus = false,
  "aria-invalid": ariaInvalid,
}: ScheduledTimeRowProps) {
  const t = useTranslations("TasksPage");

  return (
    <div className="group relative w-full min-w-0">
      {canRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("removeTime")}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
          className={cn(
            "absolute top-1/2 right-2 z-10 -translate-y-1/2 text-muted-foreground",
            "opacity-100 transition-opacity",
            "sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
            "hover:text-foreground",
            "focus-visible:opacity-100",
          )}
        >
          <XIcon aria-hidden />
        </Button>
      ) : null}
      <Input
        id={id}
        type="time"
        step="60"
        value={toTimeInputValue(value)}
        autoFocus={autoFocus}
        aria-invalid={ariaInvalid}
        onChange={(event) => {
          onChange(fromTimeInputValue(event.target.value));
        }}
        onBlur={onBlur}
        className={cn(
          "appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
          canRemove && "pr-7",
        )}
      />
    </div>
  );
}
