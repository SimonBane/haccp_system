"use client";

import { TARGET_KIND, type TargetResponse } from "@haccp/shared";
import { LayersIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";
import {
  buildTargetTree,
  flattenAreas,
  type TargetScope,
} from "@/features/targets/lib/target-tree";
import { cn } from "@/lib/utils";

type ScopeOption = {
  key: string;
  scope: TargetScope;
  label: string;
  count: number;
  depth: number;
  icon: LucideIcon;
};

export function scopeKey(scope: TargetScope): string {
  return scope.type === "area" ? `area:${scope.areaId}` : scope.type;
}

function useScopeOptions(items: readonly TargetResponse[]) {
  const t = useTranslations("TargetsPage.scope");
  const areas = flattenAreas(buildTargetTree(items));
  const childCounts = new Map<string, number>();
  for (const item of items) {
    if (item.parentId) {
      childCounts.set(item.parentId, (childCounts.get(item.parentId) ?? 0) + 1);
    }
  }

  const views: ScopeOption[] = [
    {
      key: "all",
      scope: { type: "all" },
      label: t("all"),
      count: items.length,
      depth: 0,
      icon: LayersIcon,
    },
    {
      key: "equipment",
      scope: { type: "equipment" },
      label: t("equipment"),
      count: items.filter((item) => item.kind === TARGET_KIND.EQUIPMENT).length,
      depth: 0,
      icon: TARGET_KIND_ICONS.equipment,
    },
  ];
  const areaOptions: ScopeOption[] = areas.map(({ area, depth }) => ({
    key: `area:${area.id}`,
    scope: { type: "area", areaId: area.id },
    label: area.name,
    count: childCounts.get(area.id) ?? 0,
    depth,
    icon: TARGET_KIND_ICONS.area,
  }));

  return { views, areaOptions, label: t("label"), areasLabel: t("areas") };
}

type ScopeNavProps = {
  items: readonly TargetResponse[];
  active: TargetScope;
  onSelect: (scope: TargetScope) => void;
};

export function TargetScopeRail({ items, active, onSelect }: ScopeNavProps) {
  const { views, areaOptions, label, areasLabel } = useScopeOptions(items);
  const activeKey = scopeKey(active);

  const renderOption = (option: ScopeOption) => {
    const Icon = option.icon;
    const isActive = option.key === activeKey;
    return (
      <Button
        key={option.key}
        type="button"
        variant="ghost"
        aria-current={isActive ? "true" : undefined}
        onClick={() => onSelect(option.scope)}
        style={{ paddingInlineStart: `${0.625 + option.depth}rem` }}
        className={cn(
          "w-full justify-start font-normal",
          isActive &&
            "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary",
        )}
      >
        <Icon data-icon="inline-start" />
        <span className="min-w-0 flex-1 truncate text-left">
          {option.label}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {option.count}
        </span>
      </Button>
    );
  };

  return (
    <nav aria-label={label} className="flex w-56 shrink-0 flex-col gap-5">
      <div className="flex flex-col gap-0.5">{views.map(renderOption)}</div>
      <div className="flex flex-col gap-0.5">
        <h2 className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">
          {areasLabel}
        </h2>
        {areaOptions.map(renderOption)}
      </div>
    </nav>
  );
}

export function TargetScopeChips({ items, active, onSelect }: ScopeNavProps) {
  const { views, areaOptions, label } = useScopeOptions(items);
  const activeKey = scopeKey(active);

  return (
    <nav
      aria-label={label}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {[...views, ...areaOptions].map((option) => {
        const isActive = option.key === activeKey;
        return (
          <Button
            key={option.key}
            type="button"
            variant="outline"
            aria-pressed={isActive}
            onClick={() => onSelect(option.scope)}
            className={cn(
              "shrink-0 rounded-full",
              isActive &&
                "border-primary/40 bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
            )}
          >
            {option.label}
            <span className="font-normal text-muted-foreground tabular-nums">
              {option.count}
            </span>
          </Button>
        );
      })}
    </nav>
  );
}
