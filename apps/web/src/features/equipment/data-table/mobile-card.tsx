"use client";

import type { EquipmentResponse, EquipmentType } from "@haccp/shared";
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
import { EquipmentTableRowActions } from "@/features/equipment/data-table/row-actions";

type EquipmentTranslations = ReturnType<
  typeof useTranslations<"EquipmentPage">
>;

type EquipmentMobileCardProps = {
  row: Row<EquipmentResponse>;
  t: EquipmentTranslations;
  typeLabels: Record<EquipmentType, string>;
  onEdit: (equipment: EquipmentResponse) => void;
  onDuplicate: (equipment: EquipmentResponse) => void;
  onDelete: (equipment: EquipmentResponse) => void;
};

export function EquipmentMobileCard({
  row,
  t,
  typeLabels,
  onEdit,
  onDuplicate,
  onDelete,
}: EquipmentMobileCardProps) {
  const equipment = row.original;

  return (
    <Card className="py-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{equipment.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{typeLabels[equipment.type]}</Badge>
          <span className="text-sm tabular-nums text-muted-foreground">
            {equipment.minTempC}°C – {equipment.maxTempC}°C
          </span>
        </div>
      </CardContent>
      <CardFooter className="justify-end border-t pt-3">
        <EquipmentTableRowActions
          row={row}
          t={t}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </CardFooter>
    </Card>
  );
}
