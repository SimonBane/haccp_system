"use client";

import {
  FORM_APPLIES_TO,
  sortScheduledTimes,
  type FormAppliesTo,
  type TaskTemplateResponse,
} from "@haccp/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import { DataTableRowActions } from "@/components/ui/data-table/data-table-row-actions";
import type { GetRowActions } from "@/components/ui/data-table/row-action";
import { FORM_CATEGORY_ICONS } from "@/features/forms/lib/category-icon";
import type { ScheduleLabels } from "@/features/task-templates/hooks/use-schedule-labels";
import { windowOf } from "@/features/task-templates/lib/completion-window";
import { summarizeTargetNames } from "@/features/task-templates/lib/format-targets";

type TasksTranslations = ReturnType<typeof useTranslations<"TasksPage">>;

type GetColumnsParams = {
  t: TasksTranslations;
  labels: ScheduleLabels;
  appliesToOf: (task: TaskTemplateResponse) => FormAppliesTo | null;
  getRowActions: GetRowActions<TaskTemplateResponse>;
};

/** One check per target at each time; a whole-location form is one check per time. */
export function checksPerDay(
  task: TaskTemplateResponse,
  appliesTo: FormAppliesTo | null,
): number {
  const perTime =
    appliesTo === FORM_APPLIES_TO.LOCATION || task.targets.length === 0
      ? 1
      : task.targets.length;
  return task.scheduledTimes.length * perTime;
}

export function targetsText(
  task: TaskTemplateResponse,
  appliesTo: FormAppliesTo | null,
  t: TasksTranslations,
): { names: string; count: string } {
  if (appliesTo === FORM_APPLIES_TO.LOCATION || task.targets.length === 0) {
    return { names: t("wholeLocation"), count: t("oncePerTime") };
  }
  return {
    names:
      summarizeTargetNames(
        task.targets.map((target) => target.targetName),
        (count) => t("moreTargets", { count }),
      ) ?? "",
    count: t("itemCount", { count: task.targets.length }),
  };
}

export function getColumns({
  t,
  labels,
  appliesToOf,
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
      cell: ({ row }) => {
        const Icon = FORM_CATEGORY_ICONS[row.original.formCategory];
        return (
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"
            >
              <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{row.original.title}</span>
              <span className="truncate text-xs text-muted-foreground">
                {row.original.formName}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "targets",
      accessorFn: (row) => row.targets.map((target) => target.targetName).join(", "),
      enableSorting: false,
      meta: { view_label: t("columns.targets") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.targets")} />
      ),
      cell: ({ row }) => {
        const text = targetsText(row.original, appliesToOf(row.original), t);
        return (
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{text.names}</span>
            <span className="text-xs text-muted-foreground">{text.count}</span>
          </div>
        );
      },
    },
    {
      id: "schedule",
      accessorFn: (row) => `${labels.days(row.weekdays)} ${row.scheduledTimes.join(" ")}`,
      enableSorting: false,
      meta: { view_label: t("columns.schedule") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.schedule")} />
      ),
      cell: ({ row }) => <ScheduleCell task={row.original} labels={labels} />,
    },
    {
      id: "window",
      accessorFn: (row) => labels.window(windowOf(row)),
      enableSorting: false,
      meta: { view_label: t("columns.window") },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t("columns.window")} />
      ),
      cell: ({ row }) => {
        const window = windowOf(row.original);
        return (
          <div className="flex min-w-0 flex-col items-start gap-0.5">
            {window ? (
              <span className="text-[13px]">{labels.window(window)}</span>
            ) : (
              <Badge variant="secondary">{labels.window(null)}</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {t("checksPerDay", {
                count: checksPerDay(row.original, appliesToOf(row.original)),
              })}
            </span>
          </div>
        );
      },
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

export function TimeChips({ times }: { times: readonly string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {times.map((time) => (
        <span
          key={time}
          className="rounded-md bg-muted px-1.5 py-px text-xs font-medium tabular-nums"
        >
          {time}
        </span>
      ))}
    </div>
  );
}

function ScheduleCell({
  task,
  labels,
}: {
  task: TaskTemplateResponse;
  labels: ScheduleLabels;
}) {
  const times = sortScheduledTimes([...task.scheduledTimes]);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span>{labels.days(task.weekdays)}</span>
      <TimeChips times={times.length > 4 ? [labels.times(times)] : times} />
    </div>
  );
}
