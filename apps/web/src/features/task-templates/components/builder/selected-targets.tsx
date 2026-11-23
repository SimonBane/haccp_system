"use client";

import {
  type LimitsIssue,
  type MeasurementField,
  type TargetResponse,
} from "@haccp/shared";
import { ChevronRightIcon, ThermometerIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { limitChipClass } from "@/features/forms/components/limit-chip";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import {
  formatMeasurementNumber,
  parseMeasurementDraft,
  sanitizeMeasurementDraft,
} from "@/features/forms/lib/measurement";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";
import { groupByRoom } from "@/features/task-templates/lib/group-targets";
import {
  overrideIssueKey,
  patchOwnLimit,
  setOwnLimits,
  type TargetSelection,
} from "@/features/task-templates/lib/form-helpers";
import { cn } from "@/lib/utils";

/** Past this many rows the list shows a filter and collapses behind "Show all", instead of a scroll box inside the page. */
export const SELECTED_VISIBLE_ROWS = 8;

type SelectedTargetsProps = {
  idPrefix: string;
  targets: TargetResponse[];
  selections: TargetSelection[];
  fields: MeasurementField[];
  issues: Record<string, LimitsIssue>;
  separator: string;
  onChange: (next: TargetSelection[]) => void;
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

/** What the task checks: one row per chosen item, grouped by area, each with its limits and a remove button. */
export function SelectedTargets({
  idPrefix,
  targets,
  selections,
  fields,
  issues,
  separator,
  onChange,
  onRemove,
  layout,
}: SelectedTargetsProps) {
  const t = useTranslations("TasksPage.builder.targets");
  const tl = useTranslations("TasksPage.builder.limits");
  const format = useAnswerFormat();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const byId = new Map(targets.map((target) => [target.id, target]));
  const selectionById = new Map(selections.map((selection) => [selection.targetId, selection]));
  const chosen = selections
    .map((selection) => byId.get(selection.targetId))
    .filter((target): target is TargetResponse => Boolean(target));
  const query = filter.trim().toLowerCase();
  const visible = chosen.filter((target) => !query || target.name.toLowerCase().includes(query));
  const groups = useGroups(targets, visible);
  const isMobile = layout === "mobile";
  const hasLimits = fields.length > 0;
  const many = chosen.length > SELECTED_VISIBLE_ROWS;
  const limit = many && !showAll && !query ? SELECTED_VISIBLE_ROWS : Infinity;

  const formLimits = fields
    .map((field) => {
      const limits = format.limits(field.limits, field.unit) ?? tl("noLimits");
      return fields.length > 1 ? `${field.label} ${limits}` : limits;
    })
    .join(" · ");
  const isOwn = (selection: TargetSelection) =>
    fields.some((field) => selection.overrides[field.id]?.enabled);
  /** "1 to 4 °C", "≤ 4 °C" or "No limits" — an empty box means no limit on that side, as in the form builder. */
  const ownText = (selection: TargetSelection) =>
    fields
      .map((field) => {
        const draft = selection.overrides[field.id];
        const min = draft?.min.trim() ? parseMeasurementDraft(draft.min) : null;
        const max = draft?.max.trim() ? parseMeasurementDraft(draft.max) : null;
        const unit = format.symbol(field.unit);
        const number = (value: number) => formatMeasurementNumber(value, field.unit, format.locale);
        if (min !== null && max !== null) {
          return tl("ownChip", { min: number(min), max: number(max), unit });
        }
        return format.limits({ min, max }, field.unit) ?? tl("noLimits");
      })
      .join(" · ");

  if (chosen.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        {t("nothingChosenFor", { add: t("add") })}
      </p>
    );
  }

  function limitsEditor(target: TargetResponse, selection: TargetSelection) {
    const own = isOwn(selection);
    return (
      <div className="flex flex-col gap-3">
        <ToggleGroup
          aria-label={tl("editorTitle", { name: target.name })}
          variant="outline"
          size={isMobile ? "default" : "sm"}
          spacing={2}
          className={cn(isMobile && "w-full")}
          value={[own ? "own" : "form"]}
          onValueChange={(next) => {
            const mode = next.at(-1);
            if (!mode) return;
            onChange(setOwnLimits(selections, target.id, fields, mode === "own", separator));
          }}
        >
          <ToggleGroupItem value="form" className={cn(isMobile && "flex-1")}>
            {formLimits}
          </ToggleGroupItem>
          <ToggleGroupItem value="own" className={cn(isMobile && "flex-1")}>
            {tl("useOwn")}
          </ToggleGroupItem>
        </ToggleGroup>
        {own
          ? fields.map((field) => {
              const draft = selection.overrides[field.id];
              if (!draft) return null;
              const issue = issues[overrideIssueKey(target.id, field.id)];
              const patch = (key: "min" | "max", value: string) =>
                onChange(
                  patchOwnLimit(selections, target.id, field.id, {
                    [key]: sanitizeMeasurementDraft(value, separator, field.unit),
                  }),
                );
              return (
                <div key={field.id} className="flex flex-col gap-1.5">
                  {fields.length > 1 ? (
                    <span className="text-xs text-muted-foreground">{field.label}</span>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <Input
                      inputMode="decimal"
                      className="min-w-0 flex-1"
                      placeholder={tl("noMin")}
                      aria-label={tl("minFor", { field: field.label, target: target.name })}
                      aria-invalid={Boolean(issue)}
                      value={draft.min}
                      onChange={(event) => patch("min", event.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">{tl("to")}</span>
                    <Input
                      inputMode="decimal"
                      className="min-w-0 flex-1"
                      placeholder={tl("noMax")}
                      aria-label={tl("maxFor", { field: field.label, target: target.name })}
                      aria-invalid={Boolean(issue)}
                      value={draft.max}
                      onChange={(event) => patch("max", event.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">{format.symbol(field.unit)}</span>
                  </div>
                  {issue ? (
                    <p role="alert" className="text-xs text-destructive">
                      {tl(`issues.${issue}`)}
                    </p>
                  ) : null}
                </div>
              );
            })
          : null}
      </div>
    );
  }

  function row(target: TargetResponse, last: boolean) {
    const selection = selectionById.get(target.id);
    if (!selection) return null;
    const own = isOwn(selection);
    const hasIssue = fields.some((field) => issues[overrideIssueKey(target.id, field.id)]);
    const sub = t(`kinds.${target.kind}`);
    const Icon = TARGET_KIND_ICONS[target.kind];
    const chipText = own ? ownText(selection) : formLimits;
    const chipClass = limitChipClass(
      hasIssue ? "invalid" : own ? "own" : "default",
      { interactive: true },
    );
    const isEditing = editing === target.id;

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
          {hasLimits && !isMobile ? (
            <Popover open={isEditing} onOpenChange={(open) => setEditing(open ? target.id : null)}>
              <PopoverTrigger className={chipClass} aria-label={tl("editorTitle", { name: target.name })}>
                <ThermometerIcon className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{chipText}</span>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 gap-3">
                <span className="text-[13px] font-semibold">{tl("editorTitle", { name: target.name })}</span>
                {limitsEditor(target, selection)}
                <Button type="button" size="sm" className="w-full" onClick={() => setEditing(null)}>
                  {tl("done")}
                </Button>
              </PopoverContent>
            </Popover>
          ) : null}
          {hasLimits && isMobile ? (
            <button
              type="button"
              aria-expanded={isEditing}
              aria-label={tl("editorTitle", { name: target.name })}
              onClick={() => setEditing(isEditing ? null : target.id)}
              className={chipClass}
            >
              <span className="truncate">{chipText}</span>
            </button>
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
        {isMobile && isEditing ? (
          <div className="mt-2 mr-2 mb-1 rounded-xl bg-muted/60 p-3">{limitsEditor(target, selection)}</div>
        ) : null}
        {!isEditing && hasIssue ? (
          <p role="alert" className="pt-1 pl-11 text-xs text-destructive">
            {fields
              .map((field) => issues[overrideIssueKey(target.id, field.id)])
              .filter((issue): issue is LimitsIssue => Boolean(issue))
              .map((issue) => tl(`issues.${issue}`))
              .join(" ")}
          </p>
        ) : null}
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
