"use client";

import {
  TASK_TEMPLATE_ALL_WEEKDAYS,
  TASK_TEMPLATE_WEEKDAYS,
  type TaskTemplateWeekday,
} from "@haccp/shared";
import { Button } from "@/components/ui/button";
import {
  FieldError,
  FieldLegend,
  FieldSet,
  REQUIRED_LABEL_CLASS,
} from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type WeekdayToggleStripProps = {
  id?: string;
  label: string;
  everyDayLabel: string;
  weekdaysLabel: string;
  value: TaskTemplateWeekday[];
  onValueChange: (value: TaskTemplateWeekday[]) => void;
  onBlur?: () => void;
  shortLabels: Record<TaskTemplateWeekday, string>;
  fullLabels: Record<TaskTemplateWeekday, string>;
  invalid?: boolean;
  errorMessage?: string;
};

/** Order-preserving membership check — day order in `value` doesn't matter for either preset. */
function sameDays(a: TaskTemplateWeekday[], b: TaskTemplateWeekday[]): boolean {
  return a.length === b.length && b.every((day) => a.includes(day));
}

export function WeekdayToggleStrip({
  id,
  label,
  everyDayLabel,
  weekdaysLabel,
  value,
  onValueChange,
  onBlur,
  shortLabels,
  fullLabels,
  invalid = false,
  errorMessage,
}: WeekdayToggleStripProps) {
  return (
    <FieldSet className="gap-3" data-invalid={invalid}>
      <div className="flex items-baseline justify-between gap-2">
        <FieldLegend
          variant="label"
          className={cn(REQUIRED_LABEL_CLASS, "mb-0")}
        >
          {label}
        </FieldLegend>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="border border-dashed border-input"
            aria-pressed={sameDays(value, TASK_TEMPLATE_WEEKDAYS)}
            onClick={() => onValueChange([...TASK_TEMPLATE_WEEKDAYS])}
          >
            {weekdaysLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="border border-dashed border-input"
            aria-pressed={sameDays(value, TASK_TEMPLATE_ALL_WEEKDAYS)}
            onClick={() => onValueChange([...TASK_TEMPLATE_ALL_WEEKDAYS])}
          >
            {everyDayLabel}
          </Button>
        </div>
      </div>
      <ToggleGroup
        id={id}
        aria-invalid={invalid}
        value={value}
        onValueChange={(next) => onValueChange(next as TaskTemplateWeekday[])}
        onBlur={onBlur}
        multiple
        variant="outline"
        spacing={2}
        className="grid w-full grid-cols-7"
      >
        {TASK_TEMPLATE_ALL_WEEKDAYS.map((weekday) => (
          <ToggleGroupItem
            key={weekday}
            value={weekday}
            aria-label={fullLabels[weekday]}
            className="h-(--control-h) cursor-pointer aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
          >
            {shortLabels[weekday]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {invalid && errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </FieldSet>
  );
}
