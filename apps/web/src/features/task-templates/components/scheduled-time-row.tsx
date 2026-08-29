"use client";

import { normalizeScheduledTimeInput } from "@haccp/shared";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

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
  autoFocus?: boolean;
  "aria-invalid"?: boolean;
};

export function ScheduledTimeRow({
  id,
  value,
  onChange,
  onBlur,
  onRemove,
  autoFocus = false,
  "aria-invalid": ariaInvalid,
}: ScheduledTimeRowProps) {
  const t = useTranslations("TasksPage");

  return (
    <InputGroup>
      <InputGroupInput
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
        className="appearance-none pr-0 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={t("removeTime")}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
        >
          <XIcon aria-hidden />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
