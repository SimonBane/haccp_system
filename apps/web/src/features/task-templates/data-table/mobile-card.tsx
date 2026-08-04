"use client";

import type { TaskTemplateResponse, TaskTemplateType } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  DataTableMobileCard,
  DataTableMobileCardBadge,
} from "@/components/ui/data-table/data-table-mobile-card";
import { formatScheduleSummary } from "@/features/task-templates/lib/format-schedule";
import { TaskTemplatesTableRowActions } from "@/features/task-templates/data-table/row-actions";

type TasksTranslations = ReturnType<typeof useTranslations<"TasksPage">>;

type TaskTemplatesMobileCardProps = {
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
}: TaskTemplatesMobileCardProps) {
  const task = row.original;
  const scheduleSummary = formatScheduleSummary(
    task.weekdays,
    task.scheduledTimes,
    scheduleLabels,
  );
  const timesSummary = task.scheduledTimes.join(", ");

  const metadata: { label: string; value: ReactNode }[] = [
    {
      label: t("columns.schedule"),
      value: scheduleSummary,
    },
    {
      label: t("timesLabel"),
      value: <span className="tabular-nums">{timesSummary}</span>,
    },
  ];

  if (task.type === "temperature") {
    metadata.push({
      label: t("columns.equipment"),
      value: task.equipmentName ?? "—",
    });
  }

  return (
    <DataTableMobileCard
      title={task.title}
      showChevron
      actions={
        <TaskTemplatesTableRowActions
          row={row}
          t={t}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      }
      badges={
        <DataTableMobileCardBadge>
          {typeLabels[task.type]}
        </DataTableMobileCardBadge>
      }
      metadata={metadata}
    />
  );
}
