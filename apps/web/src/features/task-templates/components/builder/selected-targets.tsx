"use client";

import { type MeasurementField, type TargetResponse } from "@haccp/shared";
import { ChevronRightIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { limitChipClass } from "@/features/forms/components/limit-chip";
import { UnitIcon } from "@/features/forms/components/unit-option";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";
import { groupByRoom } from "@/features/task-templates/lib/group-targets";
import type { TargetSelection } from "@/features/task-templates/lib/form-helpers";
import { cn } from "@/lib/utils";

/** Past this many rows the list shows a filter and collapses behind "Show all", instead of a scroll box inside the page. */
export const SELECTED_VISIBLE_ROWS = 8;

type SelectedTargetsProps = {
  idPrefix: string;
  targets: TargetResponse[];
  selections: TargetSelection[];
  fields: MeasurementField[];
  onRemove: (targetId: string) => void;
  layout: "desktop" | "mobile";
};

type Group = { key: string; label: string; rows: TargetResponse[] };

function useGroups(targets: TargetResponse[], chosen: TargetResponse[]): Group[] {
  const t = useTranslations("TasksPage.builder.targets");
  return groupByRoom(chosen, targets, t("standalone")).map((group) => ({
    key: group.key,
    label: group.label,
    rows: group.items,
  }));
}

/** What the task checks: one row per chosen item, grouped by area, each with the range it is judged by. */
export function SelectedTargets({
  idPrefix,
  targets,
  selections,
  fields,
  onRemove,
  layout,
}: SelectedTargetsProps) {
  const t = useTranslations("TasksPage.builder.targets");
  const tl = useTranslations("TasksPage.builder.limits");
  const format = useAnswerFormat();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  const byId = new Map(targets.map((target) => [target.id, target]));
  const chosen = selections
    .map((selection) => byId.get(selection.targetId))
    .filter((target): target is TargetResponse => Boolean(target));
  const query = filter.trim().toLowerCase();
  const visible = chosen.filter((target) => !query || target.name.toLowerCase().includes(query));
  const groups = useGroups(targets, visible);
  const isMobile = layout === "mobile";
  const hasLimits = fields.length > 0;
  const rangeUnit = fields.every((field) => field.unit === fields[0]?.unit)
    ? (fields[0]?.unit ?? null)
    : null;
  const many = chosen.length > SELECTED_VISIBLE_ROWS;
  const limit = many && !showAll && !query ? SELECTED_VISIBLE_ROWS : Infinity;

  /** The item's own range for each field's measurement, else the form's default: what its checks are judged by. */
  const rangeOf = (target: TargetResponse) => {
    const own = fields.some((field) => target.limits[field.parameter]);
    const text = fields
      .map((field) => {
        const limits =
          format.limits(
            target.limits[field.parameter] ?? field.limits,
            field.unit,
          ) ?? tl("noLimits");
        return fields.length > 1 ? `${field.label} ${limits}` : limits;
      })
      .join(" · ");
    return { own, text };
  };

  if (chosen.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        {t("nothingChosenFor", { add: t("add") })}
      </p>
    );
  }

  function row(target: TargetResponse, last: boolean) {
    const sub = t(`kinds.${target.kind}`);
    const Icon = TARGET_KIND_ICONS[target.kind];
    const range = rangeOf(target);
    const rangeLabel = range.own
      ? tl("own", { limits: range.text })
      : tl("formDefault", { limits: range.text });

    return (
      <li key={target.id} className={cn(isMobile ? "py-1.5 pr-0.5 pl-3" : "py-2 pr-2 pl-3", !last && "border-b")}>
        <div className="flex min-h-10 items-center gap-3">
          {isMobile ? null : (
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="size-4" />
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className={cn("truncate font-medium", isMobile ? "text-[15px] leading-5" : "text-sm")}>
              {target.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">{sub}</span>
          </div>
          {hasLimits ? (
            <span className={limitChipClass(range.own ? "own" : "default")} title={rangeLabel}>
              {isMobile ? null : <UnitIcon unit={rangeUnit} className="size-3.5 shrink-0" />}
              <span className="truncate" aria-hidden>
                {range.text}
              </span>
              <span className="sr-only">{rangeLabel}</span>
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size={isMobile ? "icon-lg" : "icon-sm"}
            className={cn(isMobile && "size-11")}
            aria-label={t("remove", { name: target.name })}
            onClick={() => onRemove(target.id)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </li>
    );
  }

  const shown = groups.reduce<{ groups: (Group & { all: number })[]; used: number }>(
    (acc, group) => {
      const room = limit - acc.used;
      if (room <= 0) return acc;
      const rows = group.rows.slice(0, room);
      return {
        groups: [...acc.groups, { ...group, all: group.rows.length, rows }],
        used: acc.used + rows.length,
      };
    },
    { groups: [], used: 0 },
  );
  const hidden = chosen.length - shown.used;

  return (
    <div className="flex flex-col gap-3.5">
      {many ? (
        <Input
          type="search"
          className={cn(!isMobile && "max-w-xs")}
          placeholder={t("filterSelected", { count: chosen.length })}
          aria-label={t("filterSelected", { count: chosen.length })}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      ) : null}
      {shown.groups.map((group) => {
        const rows = group.rows;
        const open = !collapsed[group.key];
        const listId = `${idPrefix}-selected-${group.key}`;
        return (
          <div key={group.key} className="flex flex-col gap-1.5">
            {group.label ? (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setCollapsed((current) => ({ ...current, [group.key]: open }))}
                className={cn(
                  "flex cursor-pointer items-center gap-2 self-start rounded-md pr-1.5 pl-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isMobile ? "min-h-10" : "h-7",
                )}
              >
                <ChevronRightIcon
                  aria-hidden
                  className={cn("size-3.5 text-muted-foreground transition-transform", open && "rotate-90")}
                />
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("itemsCount", { count: group.all })}
                </span>
              </button>
            ) : null}
            {open ? (
              <ul id={listId} className="rounded-xl border">
                {rows.map((target, index) => row(target, index === rows.length - 1))}
              </ul>
            ) : null}
          </div>
        );
      })}
      {visible.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{t("noMatch", { query: filter.trim() })}</p>
      ) : null}
      {many && !query ? (
        <Button
          type="button"
          variant="outline"
          className={cn("w-full", isMobile && "h-11")}
          onClick={() => setShowAll((current) => !current)}
        >
          {showAll ? t("showLess") : t("showAll", { count: chosen.length, hidden })}
        </Button>
      ) : null}
    </div>
  );
}
