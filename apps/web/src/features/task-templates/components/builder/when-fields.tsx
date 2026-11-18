"use client";

import {
  TASK_TEMPLATE_ALL_WEEKDAYS,
  TASK_TEMPLATE_MAX_SCHEDULED_TIMES,
  parseScheduledTimeToMinutes,
  scheduledTimeSchema,
  sortScheduledTimes,
  type TaskTemplateWeekday,
} from "@haccp/shared";
import { CalendarIcon, Clock3Icon, PlusIcon, RepeatIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SubPanel } from "@/features/task-templates/components/builder/builder-section";
import { useScheduleLabels } from "@/features/task-templates/hooks/use-schedule-labels";
import {
  REPEAT_INTERVALS,
  daysForPreset,
  generateRepeatTimes,
  matchDayPreset,
  minutesToTime,
  type DayPreset,
} from "@/features/task-templates/lib/schedule";
import type { TaskDraft, TimeMode } from "@/features/task-templates/lib/task-draft";
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
  const labels = useScheduleLabels();
  const [newTime, setNewTime] = useState("09:00");
  const [message, setMessage] = useState<string | null>(null);
  const isMobile = layout === "mobile";

  const preset = matchDayPreset(draft.weekdays);
  const repeatTimes = generateRepeatTimes(
    draft.repeat.every,
    draft.repeat.from,
    draft.repeat.until,
  );
  const times = draft.timeMode === "repeat" ? repeatTimes : draft.times;
  const max = TASK_TEMPLATE_MAX_SCHEDULED_TIMES;

  function addTime() {
    if (!scheduledTimeSchema.safeParse(newTime).success) {
      setMessage(tw("enterTime"));
      return;
    }
    if (draft.times.includes(newTime)) {
      setMessage(tw("duplicateTime", { time: newTime }));
      return;
    }
    if (draft.times.length >= max) {
      setMessage(tw("maxTimes", { max }));
      return;
    }
    onChange({ times: sortScheduledTimes([...draft.times, newTime]) });
    setNewTime(minutesToTime(parseScheduledTimeToMinutes(newTime) + 60));
    setMessage(null);
  }

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

        <Tabs
          value={draft.timeMode}
          onValueChange={(value) => {
            onChange({ timeMode: value as TimeMode });
            setMessage(null);
          }}
        >
          <TabsList variant="line" aria-label={tw("modeLabel")} className={cn(isMobile && "w-full")}>
            <TabsTrigger value="times">
              <Clock3Icon aria-hidden />
              {tw("modeTimes")}
            </TabsTrigger>
            <TabsTrigger value="repeat">
              <RepeatIcon aria-hidden />
              {tw("modeRepeat")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {draft.timeMode === "times" ? (
          <div className="flex flex-col gap-3">
            <div className="flex min-h-8 flex-wrap items-center gap-2">
              {draft.times.map((time) => (
                <span
                  key={time}
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-lg border border-input bg-background pl-2.5 font-medium tabular-nums",
                    isMobile ? "h-9 pr-0.5" : "h-8 pr-0.5 text-sm",
                  )}
                >
                  {time}
                  <Button
                    type="button"
                    variant="ghost"
                    size={isMobile ? "icon-sm" : "icon-xs"}
                    aria-label={tw("removeTime", { time })}
                    onClick={() => onChange({ times: draft.times.filter((value) => value !== time) })}
                  >
                    <XIcon />
                  </Button>
                </span>
              ))}
              {draft.times.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  {isMobile ? tw("noTimesShort") : tw("noTimes")}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="time"
                aria-label={tw("timeToAdd")}
                className={cn(isMobile ? "min-w-0 flex-1" : "w-34")}
                value={newTime}
                onChange={(event) => {
                  setNewTime(event.target.value);
                  setMessage(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTime();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                className={cn(isMobile && "h-11")}
                disabled={draft.times.length >= max}
                onClick={addTime}
              >
                <PlusIcon data-icon="inline-start" />
                {isMobile ? tw("add") : tw("addTime")}
              </Button>
              {!isMobile && draft.times.length > 0 ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ times: [] })}>
                  {tw("clearAll")}
                </Button>
              ) : null}
              {!isMobile ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  {tw("enterHint", { max })}
                </span>
              ) : null}
            </div>
            {message ? (
              <p role="alert" className="text-[13px] text-destructive">
                {message}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-2">
              <span id={`${idPrefix}-every`} className="text-sm leading-none font-medium">
                {tw("every")}
              </span>
              <ToggleGroup
                aria-labelledby={`${idPrefix}-every`}
                variant="outline"
                spacing={isMobile ? 1 : 2}
                className="flex-wrap"
                value={[String(draft.repeat.every)]}
                onValueChange={(next) => {
                  const value = next.at(-1);
                  if (value) onChange({ repeat: { ...draft.repeat, every: Number(value) } });
                }}
              >
                {REPEAT_INTERVALS.map((minutes) => (
                  <ToggleGroupItem key={minutes} value={String(minutes)}>
                    {labels.duration(minutes)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className={cn("gap-3", isMobile ? "grid grid-cols-2" : "flex flex-wrap")}>
              {(["from", "until"] as const).map((key) => (
                <div key={key} className={cn("flex flex-col gap-2", !isMobile && "w-34")}>
                  <label htmlFor={`${idPrefix}-repeat-${key}`} className="text-sm leading-none font-medium">
                    {tw(key)}
                  </label>
                  <Input
                    id={`${idPrefix}-repeat-${key}`}
                    type="time"
                    value={draft.repeat[key]}
                    onChange={(event) =>
                      onChange({ repeat: { ...draft.repeat, [key]: event.target.value } })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 rounded-xl bg-muted p-3">
              <p className="text-[13px] font-medium">
                {repeatTimes.length
                  ? tw("repeatSummary", {
                      count: repeatTimes.length,
                      interval: labels.duration(draft.repeat.every),
                      from: repeatTimes[0]!,
                      until: repeatTimes.at(-1)!,
                    })
                  : tw("repeatEmpty")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {repeatTimes.map((time) => (
                  <span
                    key={time}
                    className="rounded-md border bg-background px-2 py-0.5 text-[13px] font-medium tabular-nums"
                  >
                    {time}
                  </span>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant="link"
              size="sm"
              className={cn("h-auto self-start px-0", isMobile && "self-center")}
              onClick={() => onChange({ timeMode: "times", times: repeatTimes })}
            >
              {tw("toList")}
            </Button>
          </div>
        )}
        {timesError ? (
          <p role="alert" className="text-sm text-destructive">
            {tw("timesRequired")}
          </p>
        ) : null}
      </SubPanel>
    </div>
  );
}
