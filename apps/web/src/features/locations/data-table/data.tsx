"use client";

import type { LocationResponse } from "@haccp/shared";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { getColumns } from "@/features/locations/data-table/columns";

type LocationsDataProps = {
  items: LocationResponse[];
  settingDefaultId: string | null;
  onAdd: () => void;
  onRename: (location: LocationResponse) => void;
  onDelete: (location: LocationResponse) => void;
  onSetDefault: (location: LocationResponse) => void;
};

function LocationsToolbar({ onAdd, label }: { onAdd: () => void; label: string }) {
  return (
    <Button type="button" onClick={onAdd}>
      <PlusIcon />
      {label}
    </Button>
  );
}

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

  const toolbar = useMemo<ReactNode>(
    () => <LocationsToolbar onAdd={onAdd} label={t("add")} />,
    [onAdd, t],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      enableSearch
      searchColumn="name"
      searchPlaceholder={t("searchPlaceholder")}
      emptyMessage={t("emptyTitle")}
      noResultsMessage={tTable("noResults")}
      enablePagination={false}
      initialSorting={[
        { id: "default", desc: false }
      ]}
      classNameWrapper="bg-sidebar ring-1 ring-sidebar-border"
      onRowClick={(row) => onRename(row.original)}
      toolbar={toolbar}
    />
  );
}
