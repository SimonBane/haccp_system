"use client";

import type { TaskTemplateResponse, TaskTemplateType } from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { formatScheduleSummary } from "@/features/task-templates/lib/format-schedule";
import { TaskTemplatesTableRowActions } from "@/features/task-templates/data-table/row-actions";

type TasksTranslations = ReturnType<typeof useTranslations<"TasksPage">>;

type GetColumnsParams = {
  t: TasksTranslations;
  typeLabels: Record<TaskTemplateType, string>;
  scheduleLabels: {
    everyDay: string;
    weekdays: string;
    formatShort: (weekday: import("@haccp/shared").TaskTemplateWeekday) => string;
  };
  onEdit: (task: TaskTemplateResponse) => void;
  onDuplicate: (task: TaskTemplateResponse) => void;
  onDelete: (task: TaskTemplateResponse) => void;
};

export function getColumns({
  t,
  typeLabels,
  scheduleLabels,
  onEdit,
  onDuplicate,
  onDelete,
}: GetColumnsParams): ColumnDef<TaskTemplateResponse>[] {
  return [
    {
      accessorKey: "title",
      enableHiding: false,
      meta: { view_label: t("columns.title") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.title")} />
      ),
      cell: ({ row }) => <div>{row.getValue("title")}</div>,
    },
    {
      accessorKey: "type",
      meta: { view_label: t("columns.type") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.type")} />
      ),
      cell: ({ row }) => typeLabels[row.original.type],
      sortingFn: (rowA, rowB) =>
        typeLabels[rowA.original.type].localeCompare(
          typeLabels[rowB.original.type],
        ),
    },
    {
      id: "schedule",
      accessorFn: (row) =>
        formatScheduleSummary(row.weekdays, row.scheduledTimes, scheduleLabels),
      meta: { view_label: t("columns.schedule") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.schedule")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatScheduleSummary(
            row.original.weekdays,
            row.original.scheduledTimes,
            scheduleLabels,
          )}
        </span>
      ),
    },
    {
      accessorKey: "equipmentName",
      meta: { view_label: t("columns.equipment") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.equipment")} />
      ),
      cell: ({ row }) => row.original.equipmentName ?? "—",
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <TaskTemplatesTableRowActions
          row={row}
          t={t}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ),
    },
  ];
}
