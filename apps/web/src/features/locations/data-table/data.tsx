"use client";

import type { LocationResponse } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { MobileListSwipeAction } from "@/components/ui/data-table/data-table-mobile-list";
import { getColumns } from "@/features/locations/data-table/columns";
import { LocationsMobileCard } from "@/features/locations/data-table/mobile-card";

type LocationsDataProps = {
  items: LocationResponse[];
  settingDefaultId: string | null;
  onAdd: () => void;
  onRename: (location: LocationResponse) => void;
  onDelete: (location: LocationResponse) => void;
  onSetDefault: (location: LocationResponse) => void;
};

export function LocationsData({
  items,
  settingDefaultId,
  onAdd,
  onRename,
  onDelete,
  onSetDefault,
}: LocationsDataProps) {
  const t = useTranslations("LocationsPage");
  const tTable = useTranslations("DataTable");

  const columns = useMemo(
    () =>
      getColumns({
        t,
        totalCount: items.length,
        settingDefaultId,
        onRename,
        onDelete,
        onSetDefault,
      }),
    [t, items.length, settingDefaultId, onRename, onDelete, onSetDefault],
  );

  const renderSwipeActions = useCallback(
    (row: { original: LocationResponse }) => (
      <>
        <MobileListSwipeAction
          label={t("rename")}
          icon={<PencilIcon className="size-4" />}
          onClick={() => onRename(row.original)}
        />
        <MobileListSwipeAction
          label={t("delete")}
          icon={<Trash2Icon className="size-4" />}
          variant="destructive"
          onClick={() => onDelete(row.original)}
        />
      </>
    ),
    [onDelete, onRename, t],
  );

  const renderMobileRow = useCallback(
    (row: Parameters<typeof LocationsMobileCard>[0]["row"]) => (
      <LocationsMobileCard
        row={row}
        t={t}
        totalCount={items.length}
        onRename={onRename}
        onDelete={onDelete}
      />
    ),
    [t, items.length, onRename, onDelete],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      enableSearch
      searchColumn="name"
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("emptyTitle")}
      emptyAction={<DataTableAddButton onClick={onAdd} label={t("add")} />}
      noResultsMessage={tTable("noResults")}
      enablePagination={false}
      initialSorting={[
        { id: "default", desc: false }
      ]}
      toolbar={<DataTableAddButton onClick={onAdd} label={t("add")} />}
      onRowClick={(row) => onRename(row.original)}
      renderMobileRow={renderMobileRow}
      renderSwipeActions={renderSwipeActions}
    />
  );
}
