"use client";

import { TASK_TEMPLATE_TYPE, type TaskTemplateType } from "@haccp/shared";
import { ClipboardCheckIcon, ThermometerIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TASK_TYPES } from "@/features/task-templates/lib/form-helpers";

const TYPE_ICONS: Partial<Record<TaskTemplateType, typeof ThermometerIcon>> = {
  [TASK_TEMPLATE_TYPE.TEMPERATURE]: ThermometerIcon,
  [TASK_TEMPLATE_TYPE.CLEANING]: ClipboardCheckIcon,
};

type TaskTypeToggleProps = {
  id?: string;
  value: TaskTemplateType | "";
  onValueChange: (value: TaskTemplateType) => void;
  onBlur?: () => void;
  labels: Record<TaskTemplateType, string>;
  invalid?: boolean;
};

export function TaskTypeToggle({
  id,
  value,
  onValueChange,
  onBlur,
  labels,
  invalid = false,
}: TaskTypeToggleProps) {
  return (
    <ToggleGroup
      id={id}
      aria-invalid={invalid}
      value={value ? [value] : []}
      onValueChange={(next) => {
        const nextType = next[0] as TaskTemplateType | undefined;
        if (nextType) onValueChange(nextType);
      }}
      onBlur={onBlur}
      variant="outline"
      spacing={2}
      className="grid w-full grid-cols-2"
    >
      {TASK_TYPES.map((type) => {
        const Icon = TYPE_ICONS[type];
        return (
          <ToggleGroupItem
            key={type}
            value={type}
            className="h-(--control-h) gap-1.5 cursor-pointer aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
          >
            {Icon ? <Icon data-icon="inline-start" /> : null}
            {labels[type]}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
