"use client";

import type { EquipmentResponse, EquipmentType } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import {
  RefrigeratorIcon,
  SnowflakeIcon,
  StoreIcon,
} from "lucide-react";
import type { useTranslations } from "next-intl";
import { MobileListRow } from "@/components/ui/data-table/data-table-mobile-list";
import { EquipmentTableRowActions } from "@/features/equipment/data-table/row-actions";
import { formatTemp } from "@/features/equipment/lib/format";

type EquipmentTranslations = ReturnType<
  typeof useTranslations<"EquipmentPage">
>;

const EQUIPMENT_TYPE_ICONS: Record<EquipmentType, typeof RefrigeratorIcon> = {
  fridge: RefrigeratorIcon,
  freezer: SnowflakeIcon,
  display_case: StoreIcon,
};

type EquipmentMobileRowProps = {
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
}: EquipmentMobileRowProps) {
  const equipment = row.original;
  const TypeIcon = EQUIPMENT_TYPE_ICONS[equipment.type];

  return (
    <MobileListRow
      leading={
        <TypeIcon className="size-5 text-muted-foreground" aria-hidden />
      }
      title={equipment.name}
      subtitle={typeLabels[equipment.type]}
      // The allowed range is the number this list exists to show, so it goes
      // in the trailing slot rather than into a label/value row underneath.
      trailing={
        <span className="tabular-nums">
          {formatTemp(equipment.minTempC)} – {formatTemp(equipment.maxTempC)}
        </span>
      }
      actions={
        <EquipmentTableRowActions
          row={row}
          t={t}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      }
    />
  );
}
