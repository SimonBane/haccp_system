"use client";

import type { EquipmentResponse, EquipmentType } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import { RefrigeratorIcon, SnowflakeIcon, StoreIcon } from "lucide-react";
import { MobileListRow } from "@/components/ui/data-table/data-table-mobile-list";
import { formatTemp } from "@/features/equipment/lib/format";

const EQUIPMENT_TYPE_ICONS: Record<EquipmentType, typeof RefrigeratorIcon> = {
  fridge: RefrigeratorIcon,
  freezer: SnowflakeIcon,
  display_case: StoreIcon,
};

type EquipmentMobileRowProps = {
  row: Row<EquipmentResponse>;
  typeLabels: Record<EquipmentType, string>;
};

export function EquipmentMobileCard({
  row,
  typeLabels,
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
    />
  );
}
