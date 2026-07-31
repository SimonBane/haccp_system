"use client";

import type { LocationResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LocationsTableRowActions } from "@/features/locations/data-table/row-actions";

type LocationsTranslations = ReturnType<
  typeof useTranslations<"LocationsPage">
>;

type LocationsMobileCardProps = {
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
}: LocationsMobileCardProps) {
  const location = row.original;

  return (
    <Card className="py-4">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{location.name}</CardTitle>
          {location.isDefault ? (
            <Badge variant="secondary">{t("status.default")}</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent />
      <CardFooter className="justify-end border-t pt-3">
        <LocationsTableRowActions
          row={row}
          t={t}
          totalCount={totalCount}
          onRename={onRename}
          onDelete={onDelete}
        />
      </CardFooter>
    </Card>
  );
}
