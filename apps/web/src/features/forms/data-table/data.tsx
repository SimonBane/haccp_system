"use client";

import type { FormCategory, FormResponse } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { getColumns } from "@/features/forms/data-table/columns";
import { FormsMobileCard } from "@/features/forms/data-table/mobile-card";
import { getFormRowActions } from "@/features/forms/data-table/row-actions";

type FormsDataProps = {
  items: FormResponse[];
  categoryLabels: Record<FormCategory, string>;
  onAdd: () => void;
  onEdit: (form: FormResponse) => void;
  onDuplicate: (form: FormResponse) => void;
  onDelete: (form: FormResponse) => void;
};

export function FormsData({
  items,
  categoryLabels,
  onAdd,
  onEdit,
  onDuplicate,
  onDelete,
}: FormsDataProps) {
  const t = useTranslations("FormsPage");
  const tTable = useTranslations("DataTable");

  const getRowActions = useMemo(
    () => getFormRowActions({ t, onEdit, onDuplicate, onDelete }),
    [t, onEdit, onDuplicate, onDelete],
  );

  const columns = useMemo(
    () => getColumns({ t, categoryLabels, getRowActions }),
    [t, categoryLabels, getRowActions],
  );

  const renderMobileRow = useCallback(
    (row: Parameters<typeof FormsMobileCard>[0]["row"]) => (
      <FormsMobileCard row={row} t={t} categoryLabels={categoryLabels} />
    ),
    [t, categoryLabels],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      enableSearch
      searchColumn="name"
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("emptyTitle")}
      emptyDescription={t("emptyDescription")}
      emptyAction={<DataTableAddButton onClick={onAdd} label={t("add")} />}
      noResultsMessage={tTable("noResults")}
      enablePagination
      pageSize={10}
      enableColumnVisibility
      getRowId={(row) => row.id}
      toolbar={<DataTableAddButton onClick={onAdd} label={t("add")} />}
      onRowClick={(row) => onEdit(row.original)}
      renderMobileRow={renderMobileRow}
      getRowActions={(row) => getRowActions(row.original)}
      getRowLabel={(row) => row.original.name}
    />
  );
}
