"use client";

import {
  TASK_TEMPLATE_ALL_WEEKDAYS,
  TASK_TEMPLATE_MAX_SCHEDULED_TIMES,
  type TaskTemplateWeekday,
} from "@haccp/shared";
import { CalendarIcon, Clock3Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SubPanel } from "@/features/task-templates/components/builder/builder-section";
import { TimesPicker } from "@/features/task-templates/components/builder/times-picker";
import {
  daysForPreset,
  matchDayPreset,
  type DayPreset,
} from "@/features/task-templates/lib/schedule";
import type { TaskDraft } from "@/features/task-templates/lib/task-draft";
import { cn } from "@/lib/utils";

type WhenFieldsProps = {
  idPrefix: string;
  draft: TaskDraft;
  onChange: (patch: Partial<TaskDraft>) => void;
  daysError: boolean;
  timesError: boolean;
  layout: "desktop" | "mobile";
};

const DAY_PRESETS: DayPreset[] = ["every", "weekdays", "weekends"];
const PRESET_LABEL = { every: "everyDay", weekdays: "weekdays", weekends: "weekends" } as const;

export function WhenFields({
  idPrefix,
  draft,
  onChange,
  daysError,
  timesError,
  layout,
}: WhenFieldsProps) {
  const t = useTranslations("TasksPage");
  const tw = useTranslations("TasksPage.builder.when");
  const [atMax, setAtMax] = useState(false);
  const isMobile = layout === "mobile";

  const preset = matchDayPreset(draft.weekdays);
  const times = draft.times;
  const max = TASK_TEMPLATE_MAX_SCHEDULED_TIMES;

  const daysLabelId = `${idPrefix}-days-label`;

  return (
    <div className="flex flex-col gap-4">
      <SubPanel
        icon={CalendarIcon}
        title={tw("days")}
        titleId={daysLabelId}
        description={tw("daysDescription")}
        compact={isMobile}
        aside={
          <ToggleGroup
            aria-label={tw("dayPresets")}
            variant="outline"
            spacing={2}
            className={cn(isMobile && "w-full")}
            value={preset ? [preset] : []}
            onValueChange={(next) => {
              const value = next.at(-1) as DayPreset | undefined;
              if (value) onChange({ weekdays: daysForPreset(value) });
            }}
          >
            {DAY_PRESETS.map((value) => (
              <ToggleGroupItem key={value} value={value} className={cn(isMobile && "flex-1")}>
                {t(`presets.${PRESET_LABEL[value]}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      >
        <ToggleGroup
          aria-labelledby={daysLabelId}
          multiple
          variant="outline"
          spacing={isMobile ? 1 : 2}
          className={cn(isMobile && "w-full")}
          value={draft.weekdays}
          onValueChange={(next) =>
            onChange({
              weekdays: TASK_TEMPLATE_ALL_WEEKDAYS.filter((day) =>
                (next as TaskTemplateWeekday[]).includes(day),
              ),
            })
          }
        >
          {TASK_TEMPLATE_ALL_WEEKDAYS.map((day) => (
            <ToggleGroupItem
              key={day}
              value={day}
              aria-label={t(`weekdaysFull.${day}`)}
              className={cn(isMobile && "h-11 flex-1")}
            >
              {isMobile ? t(`weekdaysLetter.${day}`) : t(`weekdaysShort.${day}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {daysError ? (
          <p role="alert" className="text-sm text-destructive">
            {tw("daysRequired")}
          </p>
        ) : null}
      </SubPanel>

      <SubPanel
        icon={Clock3Icon}
        title={tw("times")}
        description={tw("timesDescription")}
        compact={isMobile}
        aside={
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {times.length ? tw("timesCount", { count: times.length }) : tw("timesUpTo", { max })}
          </span>
        }
      >

        <div className="flex flex-col gap-3">
          <TimesPicker
            id={`${idPrefix}-times`}
            value={draft.times}
            max={max}
            invalid={timesError}
            onChange={(next) => {
              setAtMax(false);
              onChange({ times: next });
            }}
            onMaxReached={() => setAtMax(true)}
          />
          {!isMobile && draft.times.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => onChange({ times: [] })}
            >
              {tw("clearAll")}
            </Button>
          ) : null}
          {atMax ? (
            <p role="alert" className="text-[13px] text-destructive">
              {tw("maxTimes", { max })}
            </p>
          ) : null}
        </div>
        {timesError ? (
          <p role="alert" className="text-sm text-destructive">
            {tw("timesRequired")}
          </p>
        ) : null}
      </SubPanel>
    </div>
  );
}
