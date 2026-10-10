"use client";

import type { TaskTemplateResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import { MobileListRow } from "@/components/ui/data-table/data-table-mobile-list";
import { FORM_CATEGORY_ICONS } from "@/features/forms/lib/category-icon";
import { summarizeTargetNames } from "@/features/task-templates/lib/format-targets";
import { formatWeekdaysLabel } from "@/features/task-templates/lib/format-schedule";
import {
  formatCompactWindowSummary,
  type CompactWindowSummaryLabels,
} from "@/features/task-templates/lib/completion-window";

type TaskTemplatesMobileRowProps = {
  row: Row<TaskTemplateResponse>;
  moreTargets: (count: number) => string;
  scheduleLabels: {
    everyDay: string;
    weekdays: string;
    formatShort: (
      weekday: import("@haccp/shared").TaskTemplateWeekday,
    ) => string;
  };
  windowSummaryLabels: CompactWindowSummaryLabels;
};

export function TaskTemplatesMobileCard({
  row,
  moreTargets,
  scheduleLabels,
  windowSummaryLabels,
}: TaskTemplatesMobileRowProps) {
  const task = row.original;

  const weekdays = formatWeekdaysLabel(task.weekdays, scheduleLabels);
  const windowSummary = formatCompactWindowSummary({
    completionOpensBeforeMinutes: task.completionOpensBeforeMinutes,
    completionDueAfterMinutes: task.completionDueAfterMinutes,
    labels: windowSummaryLabels,
  });

  const detail = [
    task.formName,
    weekdays,
    summarizeTargetNames(
      task.targets.map((target) => target.targetName),
      moreTargets,
    ),
  ]
    .filter(Boolean)
    .join(" · ");
  const CategoryIcon = FORM_CATEGORY_ICONS[task.formCategory];

  return (
    <MobileListRow
      variant="card"
      leading={
        <CategoryIcon className="size-5 text-muted-foreground" aria-hidden />
      }
      title={task.title}
      subtitle={detail}
      details={
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            {task.scheduledTimes.map((time) => (
              <span
                key={time}
                className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground"
              >
                {time}
              </span>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {windowSummary}
          </span>
        </div>
      }
    />
  );
}
