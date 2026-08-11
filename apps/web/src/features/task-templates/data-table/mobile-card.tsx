"use client";

import type { TaskTemplateResponse, TaskTemplateType } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import { ClipboardCheckIcon, ThermometerIcon } from "lucide-react";
import type { useTranslations } from "next-intl";
import { MobileListRow } from "@/components/ui/data-table/data-table-mobile-list";
import { formatScheduleSummary } from "@/features/task-templates/lib/format-schedule";
import { TaskTemplatesTableRowActions } from "@/features/task-templates/data-table/row-actions";

type TasksTranslations = ReturnType<typeof useTranslations<"TasksPage">>;

type TaskTemplatesMobileRowProps = {
  row: Row<TaskTemplateResponse>;
  t: TasksTranslations;
  typeLabels: Record<TaskTemplateType, string>;
  scheduleLabels: {
    everyDay: string;
    weekdays: string;
    formatShort: (
      weekday: import("@haccp/shared").TaskTemplateWeekday,
    ) => string;
  };
  onEdit: (task: TaskTemplateResponse) => void;
  onDuplicate: (task: TaskTemplateResponse) => void;
  onDelete: (task: TaskTemplateResponse) => void;
};

export function TaskTemplatesMobileCard({
  row,
  t,
  typeLabels,
  scheduleLabels,
  onEdit,
  onDuplicate,
  onDelete,
}: TaskTemplatesMobileRowProps) {
  const task = row.original;
  const schedule = formatScheduleSummary(
    task.weekdays,
    task.scheduledTimes,
    scheduleLabels,
  );

  // Type, schedule and (for temperature checks) the equipment, on one line —
  // the three things that distinguish one template from another.
  const detail = [
    typeLabels[task.type],
    schedule,
    task.type === "temperature" ? task.equipmentName : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <MobileListRow
      leading={
        task.type === "temperature" ? (
          <ThermometerIcon
            className="size-5 text-muted-foreground"
            aria-hidden
          />
        ) : (
          <ClipboardCheckIcon
            className="size-5 text-muted-foreground"
            aria-hidden
          />
        )
      }
      title={task.title}
      subtitle={detail}
      trailing={
        <span className="tabular-nums">{task.scheduledTimes.join(", ")}</span>
      }
      actions={
        <TaskTemplatesTableRowActions
          row={row}
          t={t}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      }
    />
  );
}
