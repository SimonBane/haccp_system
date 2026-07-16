"use client";

import type { TaskTemplateResponse, TaskTemplateType } from "@haccp/shared";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { getColumns } from "@/features/tasks/data-table/columns";

type TasksDataProps = {
  items: TaskTemplateResponse[];
  onAdd: () => void;
  onEdit: (task: TaskTemplateResponse) => void;
  onDuplicate: (task: TaskTemplateResponse) => void;
  onDelete: (task: TaskTemplateResponse) => void;
};

export function TasksData({
  items,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
}: TasksDataProps) {
  const t = useTranslations("TasksPage");
  const tTable = useTranslations("DataTable");

  const typeLabels: Record<TaskTemplateType, string> = {
    temperature: t("types.temperature"),
    cleaning: t("types.cleaning"),
    other: t("types.other"),
  };

  const scheduleLabels = useMemo(
    () => ({
      everyDay: t("presets.everyDay"),
      monFri: t("presets.monFri"),
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

  return (
    <DataTable
      columns={columns}
      data={items}
      enableSearch
      searchColumn="title"
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("emptyTitle")}
      noResultsMessage={tTable("noResults")}
      enablePagination
      pageSize={10}
      classNameWrapper="bg-sidebar ring-1 ring-sidebar-border"
      onRowClick={(row) => onEdit(row.original)}
      Toolbar={() => (
        <Button type="button" onClick={onAdd}>
          <PlusIcon />
          {t("add")}
        </Button>
      )}
    />
  );
}
