"use client";

import type { LocationResponse } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableAddButton } from "@/components/ui/data-table/data-table-add-button";
import { getColumns } from "@/features/locations/data-table/columns";
import { LocationsMobileCard } from "@/features/locations/data-table/mobile-card";
import { getLocationRowActions } from "@/features/locations/data-table/row-actions";
import { primeKeyboard } from "@/lib/keyboard-primer";

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

  // Priming has to happen inside the tap; see lib/keyboard-primer.
  const openAdd = useCallback(() => {
    primeKeyboard();
    onAdd();
  }, [onAdd]);

  const openRename = useCallback(
    (location: LocationResponse) => {
      primeKeyboard();
      onRename(location);
    },
    [onRename],
  );

  const getRowActions = useMemo(
    () =>
      getLocationRowActions({
        t,
        totalCount: items.length,
        settingDefaultId,
        onRename: openRename,
        onSetDefault,
        onDelete,
      }),
    [t, items.length, settingDefaultId, openRename, onSetDefault, onDelete],
  );

  const columns = useMemo(
    () => getColumns({ t, getRowActions }),
    [t, getRowActions],
  );

  const renderMobileRow = useCallback(
    (row: Parameters<typeof LocationsMobileCard>[0]["row"]) => (
      <LocationsMobileCard row={row} t={t} />
    ),
    [t],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      enableSearch
      searchColumn="name"
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("emptyTitle")}
      emptyAction={<DataTableAddButton onClick={openAdd} label={t("add")} />}
      noResultsMessage={tTable("noResults")}
      enablePagination={false}
      initialSorting={[{ id: "default", desc: false }]}
      toolbar={<DataTableAddButton onClick={openAdd} label={t("add")} />}
      onRowClick={(row) => openRename(row.original)}
      renderMobileRow={renderMobileRow}
      getRowActions={(row) => getRowActions(row.original)}
      getRowLabel={(row) => row.original.name}
    />
  );
}
