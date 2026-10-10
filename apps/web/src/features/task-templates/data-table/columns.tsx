"use client";

import type { FormCategory, TaskTemplateResponse } from "@haccp/shared";
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
import { FORM_CATEGORY_ICONS } from "@/features/forms/lib/category-icon";
import { summarizeTargetNames } from "@/features/task-templates/lib/format-targets";

type TasksTranslations = ReturnType<typeof useTranslations<"TasksPage">>;

type GetColumnsParams = {
  t: TasksTranslations;
  categoryLabels: Record<FormCategory, string>;
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
  categoryLabels,
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
      accessorKey: "formName",
      meta: { view_label: t("columns.form") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.form")} />
      ),
      cell: ({ row }) => {
        const Icon = FORM_CATEGORY_ICONS[row.original.formCategory];
        return (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Icon
              className="size-4 text-muted-foreground"
              aria-label={categoryLabels[row.original.formCategory]}
            />
            {row.original.formName}
          </span>
        );
      },
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
      id: "targets",
      accessorFn: (row) => row.targets.map((target) => target.targetName).join(", "),
      enableSorting: false,
      meta: { view_label: t("columns.targets") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.targets")} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {summarizeTargetNames(
            row.original.targets.map((target) => target.targetName),
            (count) => t("moreTargets", { count }),
          ) ?? "—"}
        </span>
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
