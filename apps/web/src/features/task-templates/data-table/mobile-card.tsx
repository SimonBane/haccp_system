"use client";

import {
  sortScheduledTimes,
  type FormAppliesTo,
  type TaskTemplateResponse,
} from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { MobileListRow } from "@/components/ui/data-table/data-table-mobile-list";
import { FORM_CATEGORY_ICONS } from "@/features/forms/lib/category-icon";
import {
  checksPerDay,
  targetsText,
  TimeChips,
} from "@/features/task-templates/data-table/columns";
import type { ScheduleLabels } from "@/features/task-templates/hooks/use-schedule-labels";
import { windowOf } from "@/features/task-templates/lib/completion-window";
import { cn } from "@/lib/utils";

type TaskTemplatesMobileCardProps = {
  row: Row<TaskTemplateResponse>;
  labels: ScheduleLabels;
  appliesTo: FormAppliesTo | null;
  highlighted: boolean;
};

export function TaskTemplatesMobileCard({
  row,
  labels,
  appliesTo,
  highlighted,
}: TaskTemplatesMobileCardProps) {
  const t = useTranslations("TasksPage");
  const task = row.original;
  const CategoryIcon = FORM_CATEGORY_ICONS[task.formCategory];
  const times = sortScheduledTimes([...task.scheduledTimes]);

  return (
    <MobileListRow
      variant="card"
      className={cn(highlighted && "border-primary bg-primary/5 ring-3 ring-primary/15")}
      leading={
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <CategoryIcon className="size-[18px]" aria-hidden />
        </span>
      }
      title={task.title}
      subtitle={`${task.formName} · ${targetsText(task, appliesTo, t).names}`}
      details={
        <div className="flex flex-col gap-2">
          <TimeChips times={times.length > 4 ? [labels.times(times)] : times} />
          <span className="text-xs text-muted-foreground">
            {[
              labels.days(task.weekdays),
              labels.window(windowOf(task)),
              t("checksPerDay", { count: checksPerDay(task, appliesTo) }),
            ].join(" · ")}
          </span>
        </div>
      }
    />
  );
}
