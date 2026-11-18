"use client";

import {
  TARGET_NAME_MAX_LENGTH,
  TARGET_KIND,
  type TargetResponse,
} from "@haccp/shared";
import { BrickWallIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { CharacterCount } from "@/components/character-count";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  TargetActionsMenu,
  type TargetActions,
} from "@/features/targets/components/target-actions-menu";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";
import type { TargetListRow } from "@/features/targets/lib/target-tree";
import { useLongPress } from "@/hooks/use-long-press";
import { cn } from "@/lib/utils";

const CHECKBOX_REM = 2.5;
const DEPTH_REM = 1.75;

export type InlineAddResult = "added" | "nameTaken" | "failed";

export type InlineAddKind =
  | typeof TARGET_KIND.EQUIPMENT
  | typeof TARGET_KIND.FIXTURE;

export type InlineAdding = { areaId: string; kind: InlineAddKind };

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
  adding: InlineAdding | null;
  onStartAdd: (area: TargetResponse, kind: InlineAddKind) => void;
  onCancelAdd: () => void;
  onAdd: (
    area: TargetResponse,
    name: string,
    kind: InlineAddKind,
  ) => Promise<InlineAddResult>;
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
  adding,
  onStartAdd,
  onCancelAdd,
  onAdd,
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
          {flat ? <span className="w-48">{t("columns.area")}</span> : null}
          <span className="w-32">{t("columns.tasks")}</span>
          <span className="w-20" />
        </div>
      )}
      <ul aria-label={t("title")} className="divide-y border-t md:border-t-0">
        {rows.map((row) =>
          row.type === "item" ? (
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
              onStartAdd={onStartAdd}
              actions={actions}
            />
          ) : (
            <InlineAddRow
              key={`add-${row.area.id}`}
              area={row.area}
              isEmpty={(childCounts.get(row.area.id) ?? 0) === 0}
              indentRem={
                (showCheckboxes ? CHECKBOX_REM : 0) + row.depth * DEPTH_REM
              }
              editingKind={
                adding?.areaId === row.area.id ? adding.kind : null
              }
              onStart={(kind) => onStartAdd(row.area, kind)}
              onCancel={onCancelAdd}
              onAdd={onAdd}
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
  onStartAdd: (area: TargetResponse, kind: InlineAddKind) => void;
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
  onStartAdd,
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
    <span className="truncate text-xs text-muted-foreground">
      {t("itemsInside", { count: childCount })}
    </span>
  ) : isMobile ? (
    <span className="flex min-w-0 items-center gap-1.5 text-xs">
      {flat ? (
        <span className="truncate text-muted-foreground">{location} ·</span>
      ) : null}
      {tasks}
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
        selected && "bg-primary/5",
      )}
    >
      {showCheckbox ? (
        <span className="flex w-8 shrink-0 justify-center">
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
        style={{ width: `${depth * DEPTH_REM}rem` }}
      />
      {isArea && !selecting ? (
        <Button
          type="button"
          variant="ghost"
          size={isMobile ? "icon" : "icon-xs"}
          className="text-muted-foreground"
          aria-expanded={open}
          aria-label={t(open ? "collapseArea" : "expandArea", {
            name: target.name,
          })}
          onClick={() => onOpenChange(target.id, !open)}
        >
          <ChevronRightIcon
            className={cn("transition-transform", open && "rotate-90")}
          />
        </Button>
      ) : null}
      {selecting ? (
        <label
          htmlFor={checkboxId}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2"
        >
          {nameBlock}
        </label>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3 py-2">
          {nameBlock}
        </span>
      )}
      {flat && !isMobile ? (
        <span className="flex w-48 min-w-0">
          {parent ? (
            <Badge variant="secondary" className="max-w-full">
              <span className="truncate">{parent.name}</span>
            </Badge>
          ) : (
            <span className="text-muted-foreground">{t("standalone")}</span>
          )}
        </span>
      ) : null}
      {isMobile ? null : <span className="flex w-32">{tasks}</span>}
      {selecting ? null : (
        <span className="flex w-20 shrink-0 items-center justify-end gap-1">
          {isArea ? (
            <Button
              type="button"
              variant="ghost"
              size={isMobile ? "icon-lg" : "icon-sm"}
              className="text-muted-foreground"
              aria-label={t("addEquipmentTo", { name: target.name })}
              onClick={() => onStartAdd(target, TARGET_KIND.EQUIPMENT)}
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

type InlineAddRowProps = {
  area: TargetResponse;
  isEmpty: boolean;
  indentRem: number;
  editingKind: InlineAddKind | null;
  onStart: (kind: InlineAddKind) => void;
  onCancel: () => void;
  onAdd: (
    area: TargetResponse,
    name: string,
    kind: InlineAddKind,
  ) => Promise<InlineAddResult>;
};

function InlineAddRow({
  area,
  isEmpty,
  indentRem,
  editingKind,
  onStart,
  onCancel,
  onAdd,
}: InlineAddRowProps) {
  const t = useTranslations("TargetsPage");
  const errorId = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editing = editingKind !== null;
  const isFixture = editingKind === TARGET_KIND.FIXTURE;

  const cancel = () => {
    setName("");
    setError(null);
    onCancel();
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("validation.nameRequired"));
      return;
    }
    if (!editingKind) return;
    setIsSubmitting(true);
    const result = await onAdd(area, trimmed, editingKind);
    setIsSubmitting(false);
    if (result === "nameTaken") {
      setError(
        t(isFixture ? "nameTakenFixture" : "nameTaken"),
      );
    }
    if (result === "added") {
      setName("");
      setError(null);
    }
  }

  return (
    <li
      className={cn(
        "flex min-h-12 items-center gap-2 py-1.5 ps-4 pe-2 text-sm md:ps-2",
        editing && "bg-primary/5",
      )}
    >
      <span
        aria-hidden
        className="shrink-0"
        style={{ width: `${indentRem}rem` }}
      />
      {editing ? (
        <form
          onSubmit={(event) => void submit(event)}
          className="flex min-w-0 flex-1 flex-col gap-2 py-1 md:max-w-xl md:flex-row md:items-start"
        >
          <Field data-invalid={Boolean(error)} className="min-w-0 flex-1">
            <Input
              autoFocus
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancel();
              }}
              placeholder={t(
                isFixture ? "inlineAdd.placeholderFixture" : "inlineAdd.placeholder",
              )}
              aria-label={t(isFixture ? "inlineAdd.labelFixture" : "inlineAdd.label", {
                name: area.name,
              })}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              maxLength={TARGET_NAME_MAX_LENGTH}
            />
            <div className="flex items-start justify-between gap-3">
              {error ? <FieldError id={errorId}>{error}</FieldError> : <span />}
              <CharacterCount value={name} max={TARGET_NAME_MAX_LENGTH} showFrom={0.8} />
            </div>
          </Field>
          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1 md:flex-none"
              isLoading={isSubmitting}
            >
              {t("inlineAdd.submit")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={cancel}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <>
          {isEmpty ? (
            <span className="text-muted-foreground">{t("emptyArea")}</span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            aria-label={t("addEquipmentTo", { name: area.name })}
            onClick={() => onStart(TARGET_KIND.EQUIPMENT)}
          >
            <PlusIcon data-icon="inline-start" />
            {t("addEquipment")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground"
            aria-label={t("inlineAdd.labelFixture", { name: area.name })}
            onClick={() => onStart(TARGET_KIND.FIXTURE)}
          >
            <BrickWallIcon data-icon="inline-start" />
            {t("addFixture")}
          </Button>
        </>
      )}
    </li>
  );
}
