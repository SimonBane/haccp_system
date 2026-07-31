"use client";

import type { EquipmentResponse, EquipmentType } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import {
  RefrigeratorIcon,
  SnowflakeIcon,
  StoreIcon,
  ThermometerIcon,
} from "lucide-react";
import type { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  DataTableMobileCard,
  DataTableMobileCardBadge,
} from "@/components/ui/data-table/data-table-mobile-card";
import { EquipmentTableRowActions } from "@/features/equipment/data-table/row-actions";

type EquipmentTranslations = ReturnType<
  typeof useTranslations<"EquipmentPage">
>;

const EQUIPMENT_TYPE_ICONS: Record<EquipmentType, typeof RefrigeratorIcon> = {
  fridge: RefrigeratorIcon,
  freezer: SnowflakeIcon,
  display_case: StoreIcon,
};

function formatTemp(value: number): string {
  return `${value}°C`;
}

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
  const TypeIcon = EQUIPMENT_TYPE_ICONS[equipment.type];

  const badges: ReactNode = (
    <DataTableMobileCardBadge>
      <TypeIcon className="size-3.5" aria-hidden />
      {typeLabels[equipment.type]}
    </DataTableMobileCardBadge>
  );

  return (
    <DataTableMobileCard
      title={equipment.name}
      showChevron
      actions={
        <EquipmentTableRowActions
          row={row}
          t={t}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      }
      badges={badges}
      metadata={[
        {
          label: t("allowedTempLabel"),
          value: (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <ThermometerIcon
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              {formatTemp(equipment.minTempC)} – {formatTemp(equipment.maxTempC)}
            </span>
          ),
        },
      ]}
    />
  );
}
