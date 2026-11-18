"use client";

import {
  TASK_TEMPLATE_ALL_WEEKDAYS,
  sortScheduledTimes,
  type FormAppliesTo,
  type TaskTemplateResponse,
  type TaskTemplateWeekday,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DayStrip,
  HOUR_MARKS,
  HourRuler,
  TimelineLegend,
} from "@/features/task-templates/components/day-timeline";
import { checksPerDay } from "@/features/task-templates/data-table/columns";
import { useScheduleLabels } from "@/features/task-templates/hooks/use-schedule-labels";
import { windowOf } from "@/features/task-templates/lib/completion-window";

type DayPlanProps = {
  items: TaskTemplateResponse[];
  appliesToOf: (task: TaskTemplateResponse) => FormAppliesTo | null;
  onEdit: (task: TaskTemplateResponse) => void;
};

/** Every check of the chosen weekday on one 24 h strip per task, so gaps and busy hours stand out. */
export function DayPlan({ items, appliesToOf, onEdit }: DayPlanProps) {
  const t = useTranslations("TasksPage");
  const labels = useScheduleLabels();
  const [day, setDay] = useState<TaskTemplateWeekday>("monday");

  const tasks = items.filter((task) => task.weekdays.includes(day));
  const checks = tasks.reduce((sum, task) => sum + checksPerDay(task, appliesToOf(task)), 0);

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-xs ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-semibold">{t(`weekdaysFull.${day}`)}</h2>
          <p className="text-[13px] text-muted-foreground">
            {t("plan.summary", { tasks: tasks.length, checks })}
          </p>
        </div>
        <ToggleGroup
          aria-label={t("plan.dayLabel")}
          variant="outline"
          size="sm"
          spacing={2}
          value={[day]}
          onValueChange={(next) => {
            const value = next.at(-1) as TaskTemplateWeekday | undefined;
            if (value) setDay(value);
          }}
        >
          {TASK_TEMPLATE_ALL_WEEKDAYS.map((weekday) => (
            <ToggleGroupItem
              key={weekday}
              value={weekday}
              aria-label={t(`weekdaysFull.${weekday}`)}
            >
              {t(`weekdaysShort.${weekday}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-[820px] flex-col">
          <div className="grid grid-cols-[15rem_minmax(0,1fr)] gap-4 border-b pb-2">
            <span className="text-xs text-muted-foreground">{t("plan.task")}</span>
            <HourRuler hours={HOUR_MARKS.wide} />
          </div>
          {tasks.map((task) => {
            const window = windowOf(task);
            const times = sortScheduledTimes([...task.scheduledTimes]);
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onEdit(task)}
                className="grid cursor-pointer grid-cols-[15rem_minmax(0,1fr)] items-center gap-4 border-b py-2.5 text-left outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{task.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t("plan.rowSub", {
                      checks: checksPerDay(task, appliesToOf(task)),
                      window: labels.window(window),
                    })}
                  </span>
                </span>
                <DayStrip
                  times={times}
                  window={window}
                  gridHours={HOUR_MARKS.wide}
                  label={`${task.title}: ${times.join(", ")}`}
                  className="h-7"
                />
              </button>
            );
          })}
          {tasks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("plan.empty")}</p>
          ) : null}
        </div>
      </div>

      <TimelineLegend
        check={t("plan.legendCheck")}
        window={t("plan.legendWindow")}
        anyTime={t("plan.legendAnyTime")}
      />
    </section>
  );
}
