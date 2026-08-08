"use client";

import type { TaskTemplateResponse, TaskTemplateType } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, type ReactNode } from "react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { getColumns } from "@/features/task-templates/data-table/columns";
import { TaskTemplatesMobileCard } from "@/features/task-templates/data-table/mobile-card";

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

  const columns = useMemo(
    () =>
      getColumns({
        t,
        typeLabels,
        scheduleLabels,
        onEdit,
        onDuplicate,
        onDelete,
      }),
    [t, typeLabels, scheduleLabels, onEdit, onDuplicate, onDelete],
  );

  const toolbar = useMemo<ReactNode>(
    () => <DataTableAddButton onClick={onAdd} label={t("add")} />,
    [onAdd, t],
  );

  const renderMobileCard = useCallback(
    (row: Parameters<typeof TaskTemplatesMobileCard>[0]["row"]) => (
      <TaskTemplatesMobileCard
        row={row}
        t={t}
        typeLabels={typeLabels}
        scheduleLabels={scheduleLabels}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    ),
    [t, typeLabels, scheduleLabels, onEdit, onDuplicate, onDelete],
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
      emptyAction={
        <DataTableAddButton onClick={onAdd} label={t("add")} />
      }
      noResultsMessage={tTable("noResults")}
      enablePagination
      pageSize={10}
      enableColumnVisibility
      classNameWrapper="bg-sidebar ring-1 ring-sidebar-border"
      onRowClick={(row) => onEdit(row.original)}
      renderMobileCard={renderMobileCard}
      toolbar={toolbar}
    />
  );
}
