"use client";

import type { TargetKind, TargetResponse } from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import { MobileListRow } from "@/components/ui/data-table/data-table-mobile-list";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";

type TargetsMobileCardProps = {
  row: Row<TargetResponse>;
  kindLabels: Record<TargetKind, string>;
};

export function TargetsMobileCard({ row, kindLabels }: TargetsMobileCardProps) {
  const target = row.original;
  const KindIcon = TARGET_KIND_ICONS[target.kind];

  return (
    <MobileListRow
      leading={
        <KindIcon className="size-5 text-muted-foreground" aria-hidden />
      }
      title={target.name}
      subtitle={`${target.targetTypeName} · ${kindLabels[target.kind]}`}
    />
  );
}
