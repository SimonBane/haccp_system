"use client";

import type { FormAppliesTo, TaskTemplateResponse } from "@haccp/shared";
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
import { useScheduleLabels } from "@/features/task-templates/hooks/use-schedule-labels";

type TaskTemplatesDataProps = {
  items: TaskTemplateResponse[];
  appliesToOf: (task: TaskTemplateResponse) => FormAppliesTo | null;
  highlightId: string | null;
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
  appliesToOf,
  highlightId,
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
  const labels = useScheduleLabels();
  const selectedCount = useMemo(
    () => Object.values(rowSelection).filter(Boolean).length,
    [rowSelection],
  );

  const getRowActions = useMemo(
    () => getTaskTemplateRowActions({ t, onEdit, onDuplicate, onDelete }),
    [t, onEdit, onDuplicate, onDelete],
  );

  const columns = useMemo(
    () => getColumns({ t, labels, appliesToOf, getRowActions }),
    [t, labels, appliesToOf, getRowActions],
  );

  const renderMobileRow = useCallback(
    (row: Parameters<typeof TaskTemplatesMobileCard>[0]["row"]) => (
      <TaskTemplatesMobileCard
        row={row}
        labels={labels}
        appliesTo={appliesToOf(row.original)}
        highlighted={row.original.id === highlightId}
      />
    ),
    [labels, appliesToOf, highlightId],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      enableSearch
      searchColumn="formName"
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
        selectedCount > 0 ? (
          <Button
            type="button"
            variant="destructive-solid"
            onClick={onBulkDelete}
          >
            <Trash2Icon />
            {tTable("selection.deleteSelected")}
          </Button>
        ) : (
          <DataTableAddButton onClick={onAdd} label={t("add")} />
        )
      }
      onRowClick={(row) => onEdit(row.original)}
      getRowClassName={(row) =>
        row.original.id === highlightId ? "bg-primary/[0.06]" : undefined
      }
      renderMobileRow={renderMobileRow}
      mobileVariant="card"
      getRowActions={(row) => getRowActions(row.original)}
      getRowLabel={(row) => row.original.formName}
    />
  );
}
