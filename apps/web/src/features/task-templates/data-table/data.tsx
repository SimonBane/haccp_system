"use client";

import type { TaskTemplateResponse, TaskTemplateType } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { getColumns } from "@/features/task-templates/data-table/columns";
import { TaskTemplatesMobileCard } from "@/features/task-templates/data-table/mobile-card";
import { getTaskTemplateRowActions } from "@/features/task-templates/data-table/row-actions";
import { primeKeyboard } from "@/lib/keyboard-primer";

type TaskTemplatesDataProps = {
  items: TaskTemplateResponse[];
  onAdd: () => void;
  onEdit: (task: TaskTemplateResponse) => void;
  onDuplicate: (task: TaskTemplateResponse) => void;
  onDelete: (task: TaskTemplateResponse) => void;
};

export function TaskTemplatesData({
  items,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
}: TaskTemplatesDataProps) {
  const t = useTranslations("TasksPage");
  const tTable = useTranslations("DataTable");

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

  // Priming has to happen inside the tap; see lib/keyboard-primer.
  const openAdd = useCallback(() => {
    primeKeyboard();
    onAdd();
  }, [onAdd]);

  const openEdit = useCallback(
    (task: TaskTemplateResponse) => {
      primeKeyboard();
      onEdit(task);
    },
    [onEdit],
  );

  const getRowActions = useMemo(
    () =>
      getTaskTemplateRowActions({
        t,
        onEdit: openEdit,
        onDuplicate,
        onDelete,
      }),
    [t, openEdit, onDuplicate, onDelete],
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
      emptyAction={<DataTableAddButton onClick={openAdd} label={t("add")} />}
      noResultsMessage={tTable("noResults")}
      enablePagination
      pageSize={10}
      enableColumnVisibility
      toolbar={<DataTableAddButton onClick={openAdd} label={t("add")} />}
      onRowClick={(row) => openEdit(row.original)}
      renderMobileRow={renderMobileRow}
      // A template carries a type, a weekday pattern, equipment and up to six
      // times — more than a one-line row can show without truncating.
      mobileVariant="card"
      getRowActions={(row) => getRowActions(row.original)}
      getRowLabel={(row) => row.original.title}
    />
  );
}
