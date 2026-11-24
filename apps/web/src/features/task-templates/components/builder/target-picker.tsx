"use client";

import {
  TARGET_KIND,
  TARGET_KIND_VALUES,
  TARGET_NAME_MAX_LENGTH,
  type TargetInput,
  type TargetKind,
  type TargetResponse,
} from "@haccp/shared";
import { CheckIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type KeyboardEvent } from "react";
import { CharacterCount } from "@/components/character-count";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";
import { groupByRoom } from "@/features/task-templates/lib/group-targets";
import { cn } from "@/lib/utils";

export type CreateTargetResult =
  | { kind: "created"; target: TargetResponse }
  | { kind: "taken" }
  | { kind: "failed" };

type TargetPickerProps = {
  idPrefix: string;
  targets: TargetResponse[];
  selectedIds: readonly string[];
  onToggle: (targetId: string) => void;
  onSetMany: (targetIds: string[], selected: boolean) => void;
  onCreate: (input: TargetInput) => Promise<CreateTargetResult>;
  layout: "popover" | "sheet";
};

type CreateDraft = {
  kind: TargetKind;
  name: string;
  parentId: string | null;
  error: string | null;
};

const NO_PARENT = "none";

/** The "Add" list: search, areas you can fold away, multi-select rows, and adding a new item without leaving. */
export function TargetPicker({
  idPrefix,
  targets,
  selectedIds,
  onToggle,
  onSetMany,
  onCreate,
  layout,
}: TargetPickerProps) {
  const t = useTranslations("TasksPage.builder.targets");
  const tCreate = useTranslations("TasksPage.builder.create");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [create, setCreate] = useState<CreateDraft | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const isSheet = layout === "sheet";

  const areas = targets
    .filter((target) => target.kind === TARGET_KIND.AREA)
    .sort((a, b) => a.name.localeCompare(b.name));
  const query = search.trim().toLowerCase();
  const includesQuery = (text: string) => text.toLowerCase().includes(query);

  // A search for the room keeps everything in it; otherwise rows match on their own name.
  const groups = groupByRoom(targets, targets, t("standalone"))
    .map((group) => ({
      ...group,
      total: group.items.length,
      items:
        !query || includesQuery(group.label)
          ? group.items
          : group.items.filter((target) => includesQuery(target.name)),
    }))
    .filter((group) => group.items.length > 0);

  function openCreate(name: string) {
    setCreated(null);
    setCreate({
      kind: TARGET_KIND.EQUIPMENT,
      name: name.slice(0, TARGET_NAME_MAX_LENGTH),
      parentId: null,
      error: null,
    });
  }

  function setCreateKind(kind: TargetKind) {
    if (!create) return;
    // A component always belongs to a room, so it starts in the first one.
    const parentId =
      kind === TARGET_KIND.AREA
        ? null
        : kind === TARGET_KIND.COMPONENT
          ? (create.parentId ?? areas[0]?.id ?? null)
          : create.parentId;
    setCreate({ ...create, kind, parentId });
  }

  async function submitCreate() {
    if (!create || isCreating) return;
    const name = create.name.trim();
    if (!name) {
      setCreate({ ...create, error: tCreate("nameRequired") });
      return;
    }
    if (create.kind === TARGET_KIND.COMPONENT && !create.parentId) return;
    setIsCreating(true);
    const result = await onCreate({
      name,
      kind: create.kind,
      parentId: create.kind === TARGET_KIND.AREA ? null : create.parentId,
      limits: {},
    });
    setIsCreating(false);
    if (result.kind === "taken") {
      setCreate({ ...create, error: tCreate("nameTaken", { name }) });
      return;
    }
    if (result.kind === "failed") return;
    const area = areas.find((candidate) => candidate.id === result.target.parentId);
    setCreated(area ? tCreate("addedTo", { name, area: area.name }) : tCreate("added", { name }));
    setCreate(null);
    setSearch("");
  }

  function onNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitCreate();
    }
  }

  if (create) {
    const nameId = `${idPrefix}-new-name`;
    return (
      <div className={cn("flex flex-col gap-3.5", !isSheet && "p-4")}>
        <p className="font-semibold">
          {create.kind === TARGET_KIND.AREA
            ? tCreate("titleArea")
            : create.kind === TARGET_KIND.COMPONENT
              ? tCreate("titleComponent")
              : tCreate("titleEquipment")}
        </p>
        <div className="flex flex-col gap-2">
          <span id={`${idPrefix}-new-kind`} className="text-sm leading-none font-medium">
            {tCreate("type")}
          </span>
          <ToggleGroup
            aria-labelledby={`${idPrefix}-new-kind`}
            variant="outline"
            size="sm"
            spacing={2}
            className="flex-wrap"
            value={[create.kind]}
            onValueChange={(next) => {
              const kind = next.at(-1) as TargetKind | undefined;
              if (kind) setCreateKind(kind);
            }}
          >
            {TARGET_KIND_VALUES.map((kind) => (
              <ToggleGroupItem key={kind} value={kind}>
                {tCreate(`kinds.${kind}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={nameId} className="text-sm leading-none font-medium">
            {tCreate("name")}
          </label>
          <Input
            id={nameId}
            autoFocus
            enterKeyHint="done"
            maxLength={TARGET_NAME_MAX_LENGTH}
            placeholder={
              create.kind === TARGET_KIND.AREA
                ? tCreate("placeholderArea")
                : create.kind === TARGET_KIND.COMPONENT
                  ? tCreate("placeholderComponent")
                  : tCreate("placeholderEquipment")
            }
            value={create.name}
            aria-invalid={Boolean(create.error)}
            onChange={(event) => setCreate({ ...create, name: event.target.value, error: null })}
            onKeyDown={onNameKeyDown}
          />
          <div className="flex items-start justify-between gap-3">
            {create.error ? (
              <p role="alert" className="text-sm text-destructive">
                {create.error}
              </p>
            ) : (
              <span />
            )}
            <CharacterCount value={create.name} max={TARGET_NAME_MAX_LENGTH} showFrom={0.8} />
          </div>
        </div>
        {create.kind === TARGET_KIND.COMPONENT && areas.length === 0 ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {tCreate("needsArea")}
          </p>
        ) : create.kind !== TARGET_KIND.AREA ? (
          <div className="flex flex-col gap-2">
            <span id={`${idPrefix}-new-area`} className="text-sm leading-none font-medium">
              {create.kind === TARGET_KIND.COMPONENT
                ? tCreate("whereComponent")
                : tCreate("where")}
            </span>
            <ToggleGroup
              aria-labelledby={`${idPrefix}-new-area`}
              variant="outline"
              size="sm"
              spacing={2}
              className="flex-wrap"
              value={[create.parentId ?? NO_PARENT]}
              onValueChange={(next) => {
                const value = next.at(-1);
                if (value) setCreate({ ...create, parentId: value === NO_PARENT ? null : value });
              }}
            >
              {create.kind === TARGET_KIND.COMPONENT ? null : (
                <ToggleGroupItem value={NO_PARENT}>{tCreate("standalone")}</ToggleGroupItem>
              )}
              {areas.map((area) => (
                <ToggleGroupItem key={area.id} value={area.id}>
                  {area.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">{tCreate("alsoIn")}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            className={cn(isSheet && "h-11 flex-1")}
            onClick={() => setCreate(null)}
          >
            {tCreate("cancel")}
          </Button>
          <Button
            type="button"
            className={cn(isSheet ? "h-11 flex-1" : "ml-auto")}
            isLoading={isCreating}
            disabled={create.kind === TARGET_KIND.COMPONENT && !create.parentId}
            onClick={() => void submitCreate()}
          >
            <PlusIcon data-icon="inline-start" />
            {tCreate("submit")}
          </Button>
        </div>
      </div>
    );
  }

  const newLabel = query ? t("addQuery", { query: search.trim() }) : t("new");

  return (
    <div className={cn("flex min-h-0 flex-col", isSheet && "flex-1")}>
      <div className={cn("flex flex-col gap-2", isSheet ? "pb-3" : "border-b p-2")}>
        <Input
          type="search"
          placeholder={t("search")}
          aria-label={t("search")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {created ? (
          <p role="status" className="flex items-center gap-1.5 px-1 text-[13px] text-success">
            <CheckIcon className="size-3.5" aria-hidden />
            {created}
          </p>
        ) : null}
      </div>
      <div
        role="listbox"
        aria-multiselectable="true"
        aria-label={t("add")}
        className={cn("overflow-y-auto", isSheet ? "-mx-2 px-2" : "max-h-100 p-1.5")}
      >
        {groups.map((group) => {
          const ids = group.items.map((target) => target.id);
          const selectedCount = ids.filter((id) => selectedIds.includes(id)).length;
          const allSelected = selectedCount === ids.length;
          const open = Boolean(query) || !collapsed[group.key];
          return (
            <div
              key={group.key}
              role="group"
              aria-label={group.label}
              className="mb-1.5 flex flex-col gap-px"
            >
              <div className="flex items-center gap-1 pr-1.5">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setCollapsed((current) => ({ ...current, [group.key]: open }))}
                  className={cn(
                    "flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    isSheet ? "min-h-11" : "h-8",
                  )}
                >
                  <ChevronRightIcon
                    aria-hidden
                    className={cn(
                      "size-3.5 shrink-0 text-muted-foreground transition-transform",
                      open && "rotate-90",
                    )}
                  />
                  <span className="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.label}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {selectedCount
                      ? t("groupSelected", { selected: selectedCount, total: group.total })
                      : group.total}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size={isSheet ? "sm" : "xs"}
                  className="text-primary"
                  aria-label={
                    allSelected
                      ? t("clearIn", { group: group.label })
                      : t("selectAllIn", { group: group.label })
                  }
                  onClick={() => onSetMany(ids, !allSelected)}
                >
                  {allSelected ? t("clear") : t("selectAll")}
                </Button>
              </div>
              {open
                ? group.items.map((target) => {
                    const selected = selectedIds.includes(target.id);
                    const KindIcon = TARGET_KIND_ICONS[target.kind];
                    return (
                      <button
                        key={target.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => onToggle(target.id)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          isSheet
                            ? "min-h-12 border px-3 text-[15px]"
                            : "min-h-9 py-1.5 pr-2.5 pl-7.5 text-sm",
                          selected
                            ? cn("bg-primary/[0.07] font-medium", isSheet && "border-primary/35")
                            : cn("hover:bg-muted", isSheet && "border-transparent"),
                        )}
                      >
                        <KindIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">
                          {target.kind === TARGET_KIND.AREA ? t("kinds.area") : target.name}
                        </span>
                        <CheckIcon
                          aria-hidden
                          className={cn(
                            "shrink-0 text-primary",
                            isSheet ? "size-5" : "size-4",
                            !selected && "invisible",
                          )}
                        />
                      </button>
                    );
                  })
                : null}
            </div>
          );
        })}
        {groups.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {query ? t("noMatch", { query: search.trim() }) : t("empty")}
          </p>
        ) : null}
      </div>
      <div className={cn(isSheet ? "-mx-2 pt-1" : "border-t p-1.5")}>
        <Button
          type="button"
          variant="ghost"
          className={cn("w-full justify-start text-primary", isSheet && "h-12")}
          onClick={() => openCreate(search.trim())}
        >
          <PlusIcon data-icon="inline-start" />
          {newLabel}
        </Button>
      </div>
    </div>
  );
}
