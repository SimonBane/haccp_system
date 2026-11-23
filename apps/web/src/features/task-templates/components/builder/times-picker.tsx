"use client";

import {
  TASK_TEMPLATE_TIME_OPTIONS,
  scheduledTimeSchema,
  sortScheduledTimes,
} from "@haccp/shared";
import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";

/** "1430", "14.30" and "14:30" all find 14:30. */
function matchesTime(time: string, query: string): boolean {
  const digits = query.replace(/\D/g, "");
  return time.replace(":", "").includes(digits);
}

const GRID = new Set(TASK_TEMPLATE_TIME_OPTIONS);

type TimesPickerProps = {
  id: string;
  value: string[];
  max: number;
  invalid: boolean;
  onChange: (times: string[]) => void;
  onMaxReached: () => void;
};

/** Phones keep their own time wheel; desktop picks from the shared list. */
export function TimesPicker(props: TimesPickerProps) {
  const isMobile = useIsMobile();
  return isMobile ? <NativeTimesInput {...props} /> : <TimesCombobox {...props} />;
}

function NativeTimesInput({
  id,
  value,
  max,
  invalid,
  onChange,
  onMaxReached,
}: TimesPickerProps) {
  const tw = useTranslations("TasksPage.builder.when");
  const [time, setTime] = useState("");

  function add() {
    if (!scheduledTimeSchema.safeParse(time).success || value.includes(time)) return;
    if (value.length >= max) {
      onMaxReached();
      return;
    }
    onChange(sortScheduledTimes([...value, time]));
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {value.map((entry) => (
            <span
              key={entry}
              className="inline-flex h-9 items-center gap-0.5 rounded-lg border border-input bg-background pr-0.5 pl-2.5 font-medium tabular-nums"
            >
              {entry}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={tw("removeTime", { time: entry })}
                onClick={() => onChange(value.filter((other) => other !== entry))}
              >
                <XIcon />
              </Button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Input
          id={id}
          type="time"
          aria-label={tw("timeToAdd")}
          aria-invalid={invalid}
          className="min-w-0 flex-1"
          value={time}
          onChange={(event) => setTime(event.target.value)}
        />
        <Button type="button" variant="outline" className="h-11" disabled={!time} onClick={add}>
          <PlusIcon data-icon="inline-start" />
          {tw("add")}
        </Button>
      </div>
    </div>
  );
}

/** Times are picked from a quarter-hour list; one saved off that grid still shows and can be removed. */
function TimesCombobox({
  id,
  value,
  max,
  invalid,
  onChange,
  onMaxReached,
}: TimesPickerProps) {
  const tw = useTranslations("TasksPage.builder.when");
  const anchor = useComboboxAnchor();
  const [query, setQuery] = useState("");
  // Only a time saved off the quarter-hour grid changes the list, so it stays stable while picking.
  const offGrid = value.filter((time) => !GRID.has(time)).join(",");
  const items = useMemo(
    () =>
      offGrid
        ? sortScheduledTimes([
            ...TASK_TEMPLATE_TIME_OPTIONS,
            ...offGrid.split(","),
          ])
        : TASK_TEMPLATE_TIME_OPTIONS,
    [offGrid],
  );
  // Filtered here: Base UI freezes the last query when a pick closes the list, so typing
  // straight away would keep showing the previous matches.
  const filtered = useMemo(
    () => items.filter((time) => matchesTime(time, query)),
    [items, query],
  );

  return (
    <Combobox
      items={items}
      multiple
      value={value}
      filteredItems={filtered}
      inputValue={query}
      onInputValueChange={setQuery}
      onValueChange={(next) => {
        // A pick starts the next search from scratch, rather than filtering by the last one.
        setQuery("");
        const times = Array.isArray(next) ? (next as string[]) : [];
        if (times.length > max) {
          onMaxReached();
          return;
        }
        onChange(sortScheduledTimes(times));
      }}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(times: string[]) =>
            times.map((time) => (
              <ComboboxChip key={time} className="tabular-nums">
                {time}
              </ComboboxChip>
            ))
          }
        </ComboboxValue>
        <ComboboxChipsInput
          id={id}
          aria-invalid={invalid}
          aria-label={tw("times")}
          placeholder={tw("timesPlaceholder")}
        />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>{tw("noTimeMatch")}</ComboboxEmpty>
        <ComboboxList>
          {(time: string) => (
            <ComboboxItem key={time} value={time} className="tabular-nums">
              {time}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
