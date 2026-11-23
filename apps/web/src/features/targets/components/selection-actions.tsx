"use client";

import type { TargetResponse } from "@haccp/shared";
import { MapPinIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";
import { cn } from "@/lib/utils";

type SelectionActionsProps = {
  count: number;
  destinations: { area: TargetResponse; depth: number }[];
  canMakeStandalone: boolean;
  canDelete: boolean;
  isPending: boolean;
  onMove: (areaId: string) => void;
  onMakeStandalone: () => void;
  onDelete: () => void;
  onClear: () => void;
  /** `bar` docks the buttons at the bottom of a phone screen, within thumb reach. */
  variant: "inline" | "bar";
};

export function SelectionActions({
  count,
  destinations,
  canMakeStandalone,
  canDelete,
  isPending,
  onMove,
  onMakeStandalone,
  onDelete,
  onClear,
  variant,
}: SelectionActionsProps) {
  const t = useTranslations("TargetsPage.selection");
  const AreaIcon = TARGET_KIND_ICONS.area;
  const isBar = variant === "bar";
  const size = isBar ? "lg" : "sm";

  const moveMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size={size}
            disabled={isPending || destinations.length === 0}
            className={cn(isBar && "flex-1")}
          />
        }
      >
        <MapPinIcon data-icon="inline-start" />
        {t("moveTo")}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isBar ? "start" : "end"} className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("moveToLabel", { count })}</DropdownMenuLabel>
          {destinations.map(({ area, depth }) => (
            <DropdownMenuItem
              key={area.id}
              onClick={() => onMove(area.id)}
              style={{ paddingInlineStart: `${0.5 + depth}rem` }}
            >
              <AreaIcon />
              {area.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const standaloneButton = canMakeStandalone ? (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={isPending}
      className={cn(isBar && "flex-1")}
      onClick={onMakeStandalone}
    >
      {t("makeStandalone")}
    </Button>
  ) : null;

  if (isBar) {
    return (
      <div
        role="toolbar"
        aria-label={t("toolbar")}
        className="sticky bottom-0 z-10 -mx-4 mt-auto flex gap-2 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {moveMenu}
        {standaloneButton}
        <Button
          type="button"
          variant="destructive-solid"
          size="icon-lg"
          disabled={isPending || !canDelete}
          aria-label={t("deleteCount", { count })}
          onClick={onDelete}
        >
          <Trash2Icon />
        </Button>
      </div>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label={t("toolbar")}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="me-1 text-sm text-muted-foreground tabular-nums">
        {t("count", { count })}
      </span>
      {moveMenu}
      {standaloneButton}
      <Button
        type="button"
        variant="destructive-solid"
        size="sm"
        disabled={isPending || !canDelete}
        onClick={onDelete}
      >
        <Trash2Icon data-icon="inline-start" />
        {t("delete")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("clear")}
        onClick={onClear}
      >
        <XIcon />
      </Button>
    </div>
  );
}
