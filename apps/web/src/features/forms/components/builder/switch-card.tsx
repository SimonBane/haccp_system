"use client";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** One setting per card: title, a short line on what it does, and its switch centred beside both. */
export function SwitchCard({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: Props) {
  return (
    <Field
      orientation="horizontal"
      data-disabled={disabled}
      className={cn(
        "items-center justify-between gap-4 rounded-lg border bg-card px-3.5 py-3",
        disabled && "opacity-60",
      )}
    >
      <FieldContent className="gap-0.5">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription className="text-xs">{description}</FieldDescription>
      </FieldContent>
      <Switch
        id={id}
        className="self-center"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </Field>
  );
}
