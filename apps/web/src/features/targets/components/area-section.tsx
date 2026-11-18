"use client";

import type { TargetResponse } from "@haccp/shared";
import { ChevronRightIcon, ListChecksIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  TargetActionsMenu,
  type TargetActions,
} from "@/features/targets/components/target-actions-menu";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";
import type {
  AreaContents,
  AreaNode,
} from "@/features/targets/lib/target-tree";
import { cn } from "@/lib/utils";

type AreaSectionProps = {
  node: AreaNode;
  contents: Map<string, AreaContents>;
  depth?: number;
  isOpen: (areaId: string) => boolean;
  onOpenChange: (areaId: string, open: boolean) => void;
  onAddEquipment: (area: TargetResponse) => void;
  actions: TargetActions;
};

export function AreaSection({
  node,
  contents,
  depth = 0,
  isOpen,
  onOpenChange,
  onAddEquipment,
  actions,
}: AreaSectionProps) {
  const t = useTranslations("TargetsPage");
  const { area, equipment, areas } = node;
  const open = isOpen(area.id);
  const AreaIcon = TARGET_KIND_ICONS.area;
  const isEmpty = equipment.length === 0 && areas.length === 0;

  const totals = contents.get(area.id) ?? { equipment: 0, fixtures: 0, areas: 0 };
  const summary = [
    t("summary.equipment", { count: totals.equipment }),
    totals.areas > 0 ? t("summary.areas", { count: totals.areas }) : null,
    t("taskCount", { count: area.taskCount }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Collapsible
      open={open}
      onOpenChange={(next) => onOpenChange(area.id, next)}
      render={<section aria-label={area.name} />}
      className={cn(
        depth === 0
          ? "overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10"
          : "border-t",
      )}
    >
      <div className="flex items-center gap-2 py-2 pr-2 pl-1 sm:gap-3">
        <CollapsibleTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={t(open ? "collapseArea" : "expandArea", {
                name: area.name,
              })}
            />
          }
        >
          <ChevronRightIcon
            className={cn("transition-transform", open && "rotate-90")}
          />
        </CollapsibleTrigger>
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-muted",
            depth === 0 ? "size-9" : "size-7",
          )}
        >
          <AreaIcon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              "truncate font-medium",
              depth === 0 ? "text-base" : "text-sm",
            )}
          >
            {area.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {summary}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onAddEquipment(area)}
          aria-label={t("addEquipmentTo", { name: area.name })}
        >
          <PlusIcon data-icon="inline-start" />
          <span className="hidden sm:inline">{t("addEquipment")}</span>
        </Button>
        <TargetActionsMenu target={area} actions={actions} />
      </div>

      <CollapsibleContent>
        <div className={cn(depth === 0 && "border-t", "pl-4 sm:pl-10")}>
          {isEmpty ? (
            <p className="py-3 pr-4 text-sm text-muted-foreground">
              {t("emptyArea")}
            </p>
          ) : (
            <ul className="divide-y">
              {equipment.map((item) => (
                <li key={item.id}>
                  <TargetRow target={item} actions={actions} />
                </li>
              ))}
            </ul>
          )}
          {areas.map((child) => (
            <AreaSection
              key={child.area.id}
              node={child}
              contents={contents}
              depth={depth + 1}
              isOpen={isOpen}
              onOpenChange={onOpenChange}
              onAddEquipment={onAddEquipment}
              actions={actions}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function TargetRow({
  target,
  actions,
}: {
  target: TargetResponse;
  actions: TargetActions;
}) {
  const t = useTranslations("TargetsPage");
  const KindIcon = TARGET_KIND_ICONS[target.kind];

  return (
    <div className="flex min-h-12 items-center gap-3 py-1 pr-2">
      <KindIcon className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
        <span className="min-w-0 truncate text-sm sm:flex-1">
          {target.name}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <ListChecksIcon className="hidden size-3.5 sm:block" />
          {t("taskCount", { count: target.taskCount })}
        </span>
      </div>
      <TargetActionsMenu target={target} actions={actions} />
    </div>
  );
}
