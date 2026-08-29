"use client";

import type { TaskTemplateResponse, TaskTemplateType } from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { formatScheduleSummary } from "@/features/task-templates/lib/format-schedule";
import {
  formatCompactWindowSummary,
  type CompactWindowSummaryLabels,
} from "@/features/task-templates/lib/completion-window";
import { DataTableRowActions } from "@/components/ui/data-table/data-table-row-actions";
import type { GetRowActions } from "@/components/ui/data-table/row-action";

type TasksTranslations = ReturnType<typeof useTranslations<"TasksPage">>;

type GetColumnsParams = {
  t: TasksTranslations;
  typeLabels: Record<TaskTemplateType, string>;
  scheduleLabels: {
    everyDay: string;
    weekdays: string;
    formatShort: (weekday: import("@haccp/shared").TaskTemplateWeekday) => string;
  };
  windowSummaryLabels: CompactWindowSummaryLabels;
  getRowActions: GetRowActions<TaskTemplateResponse>;
};

export function getColumns({
  t,
  typeLabels,
  scheduleLabels,
  windowSummaryLabels,
  getRowActions,
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
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {typeLabels[row.original.type]}
        </span>
      ),
      sortingFn: (rowA, rowB) =>
        typeLabels[rowA.original.type].localeCompare(
          typeLabels[rowB.original.type],
        ),
    },
    {
      id: "schedule",
      accessorFn: (row) =>
        formatScheduleSummary(row.weekdays, row.scheduledTimes, scheduleLabels),
      enableSorting: false,
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
      id: "window",
      accessorFn: (row) =>
        formatCompactWindowSummary({
          completionOpensBeforeMinutes: row.completionOpensBeforeMinutes,
          completionDueAfterMinutes: row.completionDueAfterMinutes,
          labels: windowSummaryLabels,
        }),
      enableSorting: false,
      meta: { view_label: t("columns.window") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.window")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatCompactWindowSummary({
            completionOpensBeforeMinutes: row.original.completionOpensBeforeMinutes,
            completionDueAfterMinutes: row.original.completionDueAfterMinutes,
            labels: windowSummaryLabels,
          })}
        </span>
      ),
    },
    {
      accessorKey: "equipmentName",
      meta: { view_label: t("columns.equipment") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.equipment")} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">{row.original.equipmentName}</span>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <DataTableRowActions
          srLabel={t("openMenu")}
          actions={getRowActions(row.original)}
        />
      ),
    },
  ];
}
