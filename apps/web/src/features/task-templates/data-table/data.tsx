"use client";

import type { TaskTemplateResponse, TaskTemplateType } from "@haccp/shared";
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

  const typeLabels = useMemo<Record<TaskTemplateType, string>>(
    () => ({
      temperature: t("types.temperature"),
      cleaning: t("types.cleaning"),
      other: t("types.other"),
    }),
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

  const columns = useMemo(
    () => getColumns({ t, typeLabels, scheduleLabels, getRowActions }),
    [t, typeLabels, scheduleLabels, getRowActions],
  );

  const renderMobileRow = useCallback(
    (row: Parameters<typeof TaskTemplatesMobileCard>[0]["row"]) => (
      <TaskTemplatesMobileCard
        row={row}
        typeLabels={typeLabels}
        scheduleLabels={scheduleLabels}
      />
    ),
    [typeLabels, scheduleLabels],
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
      // A template carries a type, a weekday pattern, equipment and up to six
      // times — more than a one-line row can show without truncating.
      mobileVariant="card"
      getRowActions={(row) => getRowActions(row.original)}
      getRowLabel={(row) => row.original.title}
    />
  );
}
