"use client";

import type { LocationResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import { MapPinIcon } from "lucide-react";
import type { useTranslations } from "next-intl";
import {
  MobileListBadge,
  MobileListRow,
} from "@/components/ui/data-table/data-table-mobile-list";
import { LocationsTableRowActions } from "@/features/locations/data-table/row-actions";

type LocationsTranslations = ReturnType<
  typeof useTranslations<"LocationsPage">
>;

type LocationsMobileRowProps = {
  row: Row<LocationResponse>;
  t: LocationsTranslations;
  totalCount: number;
  onRename: (location: LocationResponse) => void;
  onDelete: (location: LocationResponse) => void;
};

export function LocationsMobileCard({
  row,
  t,
  totalCount,
  onRename,
  onDelete,
}: LocationsMobileRowProps) {
  const location = row.original;

  return (
    <MobileListRow
      leading={
        <MapPinIcon className="size-5 text-muted-foreground" aria-hidden />
      }
      title={location.name}
      trailing={
        location.isDefault ? (
          <MobileListBadge>{t("status.default")}</MobileListBadge>
        ) : null
      }
      showChevron={false}
      actions={
        <LocationsTableRowActions
          row={row}
          t={t}
          totalCount={totalCount}
          onRename={onRename}
          onDelete={onDelete}
        />
      }
    />
  );
}
