"use client";

import { TARGET_KIND, type TargetResponse } from "@haccp/shared";
import { ChevronDownIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  TargetActionsMenu,
  type TargetActions,
} from "@/features/targets/components/target-actions-menu";
import { ItemRange } from "@/features/targets/components/item-range";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";
import type { TargetListRow } from "@/features/targets/lib/target-tree";
import { useLongPress } from "@/hooks/use-long-press";
import { cn } from "@/lib/utils";

// One nesting step puts a child's expand slot under its parent's icon.
const DEPTH_REM = { desktop: 2, mobile: 1.5 };

type TargetListProps = {
  rows: TargetListRow[];
  itemsById: ReadonlyMap<string, TargetResponse>;
  childCounts: ReadonlyMap<string, number>;
  /** Flat equipment list: shows each item's area instead of nesting it. */
  flat: boolean;
  isMobile: boolean;
  showCheckboxes: boolean;
  selected: ReadonlySet<string>;
  onToggleSelected: (id: string) => void;
  onToggleAll: () => void;
  onLongPress: (id: string) => void;
  isOpen: (areaId: string) => boolean;
  onOpenChange: (areaId: string, open: boolean) => void;
  onAddToArea: (area: TargetResponse) => void;
  actions: TargetActions;
};

export function TargetList({
  rows,
  itemsById,
  childCounts,
  flat,
  isMobile,
  showCheckboxes,
  selected,
  onToggleSelected,
  onToggleAll,
  onLongPress,
  isOpen,
  onOpenChange,
  onAddToArea,
  actions,
}: TargetListProps) {
  const t = useTranslations("TargetsPage");
  const itemRows = rows.filter((row) => row.type === "item");
  const selectedCount = itemRows.filter((row) =>
    selected.has(row.target.id),
  ).length;
  const allSelected = itemRows.length > 0 && selectedCount === itemRows.length;

  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      {isMobile ? null : (
        <div className="flex h-10 items-center gap-2 bg-muted/60 px-2 text-xs font-medium">
          <span className="flex w-8 justify-center">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onToggleAll}
              aria-label={t("selection.selectAll")}
            />
          </span>
          <span className="min-w-0 flex-1">{t("columns.name")}</span>
          {flat ? <span className="w-44">{t("columns.area")}</span> : null}
          <span className="w-48">{t("columns.range")}</span>
          <span className="w-28">{t("columns.tasks")}</span>
          <span className="w-20" />
        </div>
      )}
      <ul aria-label={t("title")} className="divide-y border-t md:border-t-0">
        {rows.map((row) =>
          row.type === "standalone" ? (
            <li
              key="standalone"
              className="flex h-10 items-center gap-2 bg-muted/40 px-4 text-xs font-medium text-muted-foreground"
            >
              <span>{t("standaloneGroup")}</span>
              <span className="font-normal tabular-nums">
                {t("summary.equipment", { count: row.count })}
              </span>
            </li>
          ) : (
            <TargetListItem
              key={row.target.id}
              target={row.target}
              depth={row.depth}
              parent={
                row.target.parentId
                  ? (itemsById.get(row.target.parentId) ?? null)
                  : null
              }
              childCount={childCounts.get(row.target.id) ?? 0}
              flat={flat}
              isMobile={isMobile}
              showCheckbox={showCheckboxes}
              selected={selected.has(row.target.id)}
              onToggleSelected={onToggleSelected}
              onLongPress={onLongPress}
              open={isOpen(row.target.id)}
              onOpenChange={onOpenChange}
              onAddToArea={onAddToArea}
              actions={actions}
            />
          ),
        )}
      </ul>
    </div>
  );
}

type TargetListItemProps = {
  target: TargetResponse;
  depth: number;
  parent: TargetResponse | null;
  childCount: number;
  flat: boolean;
  isMobile: boolean;
  showCheckbox: boolean;
  selected: boolean;
  onToggleSelected: (id: string) => void;
  onLongPress: (id: string) => void;
  open: boolean;
  onOpenChange: (areaId: string, open: boolean) => void;
  onAddToArea: (area: TargetResponse) => void;
  actions: TargetActions;
};

function TargetListItem({
  target,
  depth,
  parent,
  childCount,
  flat,
  isMobile,
  showCheckbox,
  selected,
  onToggleSelected,
  onLongPress,
  open,
  onOpenChange,
  onAddToArea,
  actions,
}: TargetListItemProps) {
  const t = useTranslations("TargetsPage");
  const checkboxId = useId();
  const isArea = target.kind === TARGET_KIND.AREA;
  const KindIcon = TARGET_KIND_ICONS[target.kind];
  const selecting = isMobile && showCheckbox;
  const { ref } = useLongPress(
    () => onLongPress(target.id),
    isMobile && !showCheckbox,
  );

  const location = parent ? parent.name : t("standalone");
  const tasks =
    target.taskCount === 0 ? (
      <Badge variant="warning">{t("noTasks")}</Badge>
    ) : (
      <span className="text-muted-foreground">
        {t("taskCount", { count: target.taskCount })}
      </span>
    );

  const meta = isArea ? (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span className="truncate">{t("itemsInside", { count: childCount })}</span>
      {isMobile ? <ItemRange target={target} variant="inline" /> : null}
    </span>
  ) : isMobile ? (
    <span className="flex min-w-0 items-center gap-1.5 text-xs">
      {flat ? (
        <span className="truncate text-muted-foreground">{location} ·</span>
      ) : null}
      {tasks}
      <span className="text-muted-foreground">
        <ItemRange target={target} variant="inline" />
      </span>
    </span>
  ) : null;

  const nameBlock = (
    <>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg",
          isMobile ? "size-9" : "size-8",
          isArea ? "bg-muted" : "border text-muted-foreground",
        )}
      >
        <KindIcon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("truncate", isArea && "font-medium")}>
          {target.name}
        </span>
        {meta}
      </span>
    </>
  );

  return (
    <li
      ref={ref}
      className={cn(
        "flex items-center gap-2 px-2 text-sm",
        isMobile ? "min-h-15 ps-4" : "min-h-13",
        depth > 0 && "bg-muted/30",
        !selecting && "cursor-pointer hover:bg-muted/50",
        selected && "bg-primary/5",
      )}
      // Pointer-only: the name button stays the keyboard path to edit.
      onClick={(event) => {
        if (selecting) return;
        const clicked = event.target as HTMLElement;
        if (
          clicked.closest("button, [data-row-ignore]") ||
          clicked.closest('[role="menu"]')
        ) {
          return;
        }
        actions.onEdit(target);
      }}
    >
      {showCheckbox ? (
        <span data-row-ignore className="flex w-8 shrink-0 justify-center self-stretch items-center">
          <Checkbox
            id={checkboxId}
            checked={selected}
            onCheckedChange={() => onToggleSelected(target.id)}
            aria-label={t("selection.select", { name: target.name })}
          />
        </span>
      ) : null}
      <span
        aria-hidden
        className="shrink-0"
        style={{
          width: `${depth * (isMobile ? DEPTH_REM.mobile : DEPTH_REM.desktop)}rem`,
        }}
      />
      {flat || selecting ? null : !isArea || childCount === 0 ? (
        <span
          aria-hidden
          className={cn("shrink-0", isMobile ? "size-9" : "size-6")}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size={isMobile ? "icon" : "icon-xs"}
          className="text-muted-foreground aria-expanded:bg-transparent aria-expanded:text-muted-foreground aria-expanded:hover:bg-muted"
          aria-expanded={open}
          aria-label={t(open ? "collapseArea" : "expandArea", {
            name: target.name,
          })}
          onClick={() => onOpenChange(target.id, !open)}
        >
          {open ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </Button>
      )}
      {selecting ? (
        <label
          htmlFor={checkboxId}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2"
        >
          {nameBlock}
        </label>
      ) : (
        <button
          type="button"
          onClick={() => actions.onEdit(target)}
          className="-my-px flex min-w-0 flex-1 cursor-pointer items-center gap-3 self-stretch rounded-md py-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {nameBlock}
        </button>
      )}
      {flat && !isMobile ? (
        <span className="flex w-44 min-w-0">
          {parent ? (
            <Badge variant="secondary" className="max-w-full">
              <span className="truncate">{parent.name}</span>
            </Badge>
          ) : (
            <span className="text-muted-foreground">{t("standalone")}</span>
          )}
        </span>
      ) : null}
      {isMobile ? null : (
        <span className="flex w-48 min-w-0">
          <ItemRange target={target} variant="chip" />
        </span>
      )}
      {isMobile ? null : <span className="flex w-28">{tasks}</span>}
      {selecting ? null : (
        <span data-row-ignore className="flex w-20 shrink-0 items-center justify-end gap-1 self-stretch">
          {isArea ? (
            <Button
              type="button"
              variant="ghost"
              size={isMobile ? "icon-lg" : "icon-sm"}
              className="text-muted-foreground"
              aria-label={t("addTo", { name: target.name })}
              onClick={() => onAddToArea(target)}
            >
              <PlusIcon />
            </Button>
          ) : null}
          <TargetActionsMenu target={target} actions={actions} />
        </span>
      )}
    </li>
  );
}
