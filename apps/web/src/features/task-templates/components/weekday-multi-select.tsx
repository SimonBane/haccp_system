"use client";

import {
  TASK_TEMPLATE_ALL_WEEKDAYS,
  type TaskTemplateWeekday,
} from "@haccp/shared";
import { useMemo } from "react";
import {
  Combobox,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxTruncatedChips,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

type WeekdayMultiSelectProps = {
  id?: string;
  value: TaskTemplateWeekday[];
  onValueChange: (value: TaskTemplateWeekday[]) => void;
  onBlur?: () => void;
  labels: Record<TaskTemplateWeekday, string>;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  maxVisibleChips?: number;
  moreSelectedLabel: (count: number) => string;
  overflowRemoveLabel?: (count: number) => string;
  selectOnly?: boolean;
};

export function WeekdayMultiSelect({
  id,
  value,
  onValueChange,
  onBlur,
  labels,
  disabled = false,
  invalid = false,
  placeholder,
  emptyMessage,
  maxVisibleChips = 7,
  moreSelectedLabel,
  overflowRemoveLabel,
  selectOnly = false,
}: WeekdayMultiSelectProps) {
  const anchor = useComboboxAnchor();

  const selectedWeekdays = useMemo(
    () =>
      value.filter((weekday): weekday is TaskTemplateWeekday =>
        TASK_TEMPLATE_ALL_WEEKDAYS.includes(weekday),
      ),
    [value],
  );

  const handleValueChange = (nextWeekdays: TaskTemplateWeekday[]) => {
    onValueChange(nextWeekdays);
  };

  const showRemove = !selectOnly;

  return (
    <Combobox
      items={TASK_TEMPLATE_ALL_WEEKDAYS}
      multiple
      disabled={disabled}
      value={selectedWeekdays}
      onValueChange={(nextValue) => {
        const nextWeekdays = Array.isArray(nextValue) ? nextValue : [];
        handleValueChange(nextWeekdays);
      }}
      itemToStringLabel={(weekday) => labels[weekday]}
      isItemEqualToValue={(item, selectedValue) => item === selectedValue}
    >
      <ComboboxChips
        ref={anchor}
        className={cn(
          "w-full",
          selectOnly && "cursor-pointer",
          invalid && "border-destructive ring-destructive/20",
        )}
        aria-invalid={invalid}
      >
        <ComboboxValue>
          {(weekdays: TaskTemplateWeekday[]) => (
            <ComboboxTruncatedChips
              items={weekdays}
              maxVisible={maxVisibleChips}
              getItemKey={(weekday) => weekday}
              getItemLabel={(weekday) => labels[weekday]}
              moreLabel={moreSelectedLabel}
              showRemove={showRemove}
              overflowRemoveLabel={overflowRemoveLabel}
              onRemoveOverflow={
                showRemove
                  ? () => handleValueChange(weekdays.slice(0, maxVisibleChips))
                  : undefined
              }
            />
          )}
        </ComboboxValue>
        <ComboboxChipsInput
          id={id}
          placeholder={placeholder}
          selectOnly={selectOnly}
          onBlur={onBlur}
        />
        {selectOnly ? (
          <ComboboxTrigger
            className="shrink-0 text-muted-foreground"
            disabled={disabled}
          />
        ) : null}
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {(weekday: TaskTemplateWeekday) => (
            <ComboboxItem key={weekday} value={weekday}>
              {labels[weekday]}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
