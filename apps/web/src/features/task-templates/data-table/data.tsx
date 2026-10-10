"use client";

import {
  FORM_CATEGORY_VALUES,
  type FormCategory,
  type TaskTemplateResponse,
} from "@haccp/shared";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { getColumns } from "@/features/task-templates/data-table/columns";
import { TaskTemplatesMobileCard } from "@/features/task-templates/data-table/mobile-card";
import { getTaskTemplateRowActions } from "@/features/task-templates/data-table/row-actions";
import type { CompactWindowSummaryLabels } from "@/features/task-templates/lib/completion-window";

type TaskTemplatesDataProps = {
  items: TaskTemplateResponse[];
  onAdd: () => void;
  onEdit: (task: TaskTemplateResponse) => void;
  onDuplicate: (task: TaskTemplateResponse) => void;
  onDelete: (task: TaskTemplateResponse) => void;
  onBulkDelete: () => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
};

export function TaskTemplatesData({
  items,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
  onBulkDelete,
  rowSelection,
  onRowSelectionChange,
}: TaskTemplatesDataProps) {
  const t = useTranslations("TasksPage");
  const tTable = useTranslations("DataTable");
  const selectedCount = useMemo(
    () => Object.values(rowSelection).filter(Boolean).length,
    [rowSelection],
  );

  const tForms = useTranslations("Forms");
  const categoryLabels = useMemo(
    () =>
      Object.fromEntries(
        FORM_CATEGORY_VALUES.map((category) => [
          category,
          tForms(`categories.${category}`),
        ]),
      ) as Record<FormCategory, string>,
    [tForms],
  );
  const moreTargets = useCallback(
    (count: number) => t("moreTargets", { count }),
    [t],
  );

  const scheduleLabels = useMemo(
    () => ({
      everyDay: t("presets.everyDay"),
      weekdays: t("presets.weekdays"),
      formatShort: (weekday: import("@haccp/shared").TaskTemplateWeekday) =>
        t(`weekdaysShort.${weekday}`),
    }),
    [t],
  );

  const getRowActions = useMemo(
    () =>
      getTaskTemplateRowActions({
        t,
        onEdit,
        onDuplicate,
        onDelete,
      }),
    [t, onEdit, onDuplicate, onDelete],
  );

  const windowSummaryLabels = useMemo<CompactWindowSummaryLabels>(
    () => ({
      fromStartOfDay: t("completionWindow.compactFromStartOfDay"),
      opensBefore: (minutes) =>
        t("completionWindow.compactOpensBefore", { minutes }),
      neverOverdue: t("completionWindow.compactNeverOverdue"),
      overdueAfter: (minutes) =>
        t("completionWindow.compactOverdueAfter", { minutes }),
    }),
    [t],
  );

  const columns = useMemo(
    () =>
      getColumns({
        t,
        categoryLabels,
        scheduleLabels,
        windowSummaryLabels,
        getRowActions,
      }),
    [t, categoryLabels, scheduleLabels, windowSummaryLabels, getRowActions],
  );

  const renderMobileRow = useCallback(
    (row: Parameters<typeof TaskTemplatesMobileCard>[0]["row"]) => (
      <TaskTemplatesMobileCard
        row={row}
        moreTargets={moreTargets}
        scheduleLabels={scheduleLabels}
        windowSummaryLabels={windowSummaryLabels}
      />
    ),
    [moreTargets, scheduleLabels, windowSummaryLabels],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      enableSearch
      searchColumn="title"
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("emptyTitle")}
      emptyDescription={t("emptyDescription")}
      emptyAction={<DataTableAddButton onClick={onAdd} label={t("add")} />}
      noResultsMessage={tTable("noResults")}
      enablePagination
      pageSize={10}
      enableColumnVisibility
      enableRowSelection
      getRowId={(row) => row.id}
      rowSelection={rowSelection}
      onRowSelectionChange={onRowSelectionChange}
      toolbar={
        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <Button type="button" variant="destructive" onClick={onBulkDelete}>
              <Trash2Icon />
              {tTable("selection.deleteSelected")}
            </Button>
          ) : null}
          <DataTableAddButton onClick={onAdd} label={t("add")} />
        </div>
      }
      onRowClick={(row) => onEdit(row.original)}
      renderMobileRow={renderMobileRow}
      mobileVariant="card"
      getRowActions={(row) => getRowActions(row.original)}
      getRowLabel={(row) => row.original.title}
    />
  );
}
