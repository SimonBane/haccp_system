"use client";

import {
  TARGET_KIND,
  type TargetInput,
  type TargetResponse,
} from "@haccp/shared";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiQueryError } from "@/components/api-query-error";
import {
  MobileHeaderAddAction,
  PageHeader,
} from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { SearchInput } from "@/components/ui/search-input";
import { Spinner } from "@/components/ui/spinner";
import { ScopeFilter } from "@/features/targets/components/scope-filter";
import { SelectionActions } from "@/features/targets/components/selection-actions";
import type { TargetActions } from "@/features/targets/components/target-actions-menu";
import { TargetList } from "@/features/targets/components/target-list";
import { TargetsOnboarding } from "@/features/targets/components/targets-onboarding";
import { useTargetsMutations } from "@/features/targets/hooks/use-targets-mutations";
import { useTargetsQuery } from "@/features/targets/hooks/use-targets-query";
import { planContentsCopy } from "@/features/targets/lib/duplicate-contents";
import {
  buildTargetRows,
  moveDestinations,
  planDeletion,
  type TargetScope,
} from "@/features/targets/lib/target-tree";
import {
  TargetsForm,
  type TargetsFormDefaults,
} from "@/features/targets/targets-form";
import { useIsMobile } from "@/hooks/use-mobile";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";

type TargetsManagerProps = {
  initialItems: TargetResponse[];
  initialLocationId: string;
};

export function TargetsManager({
  initialItems,
  initialLocationId,
}: TargetsManagerProps) {
  const t = useTranslations("TargetsPage");
  const showApiError = useApiErrorToast();
  const isMobile = useIsMobile();
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTargetsQuery({ initialData: initialItems, initialLocationId });
  const { create, duplicate, update, remove } = useTargetsMutations();

  const [scope, setScope] = useState<TargetScope>("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [isBulkPending, setIsBulkPending] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formDefaults, setFormDefaults] = useState<TargetsFormDefaults>({
    kind: TARGET_KIND.EQUIPMENT,
    parentId: null,
    inArea: false,
  });
  const [editingTarget, setEditingTarget] = useState<TargetResponse | null>(
    null,
  );
  const [duplicateSource, setDuplicateSource] = useState<TargetResponse | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<TargetResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const itemsById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const childCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (item.parentId) {
        counts.set(item.parentId, (counts.get(item.parentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [items]);
  const areaCount = items.filter(
    (item) => item.kind === TARGET_KIND.AREA,
  ).length;
  const hasAreas = areaCount > 0;

  // Without rooms there is nothing to filter by.
  const activeScope: TargetScope = hasAreas ? scope : "all";

  const isOpen = useCallback(
    (areaId: string) => !collapsed.has(areaId),
    [collapsed],
  );
  const rows = useMemo(
    () => buildTargetRows(items, { scope: activeScope, query, isOpen }),
    [items, activeScope, query, isOpen],
  );

  const selectedIds = useMemo(
    () => new Set([...selected].filter((id) => itemsById.has(id))),
    [selected, itemsById],
  );
  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const destinations = useMemo(
    () => moveDestinations(items, selectedIds),
    [items, selectedIds],
  );
  const deletion = useMemo(
    () => planDeletion(items, selectedIds),
    [items, selectedIds],
  );
  const deletableCount = deletion.waves.flat().length;
  const mobileSelecting = isMobile && selectedIds.size > 0;

  const changeScope = (next: TargetScope) => {
    setScope(next);
    setSelected(new Set());
  };

  const setAreaOpen = useCallback((areaId: string, open: boolean) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (open) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const visibleIds = rows.flatMap((row) =>
    row.type === "item" ? [row.target.id] : [],
  );
  const toggleAll = () =>
    setSelected((current) =>
      visibleIds.every((id) => current.has(id))
        ? new Set()
        : new Set(visibleIds),
    );
  const clearSelection = () => setSelected(new Set());

  const openCreateForm = useCallback((defaults: TargetsFormDefaults) => {
    setEditingTarget(null);
    setDuplicateSource(null);
    setFormDefaults(defaults);
    setFormOpen(true);
  }, []);

  const openAdd = () =>
    openCreateForm({
      kind: TARGET_KIND.EQUIPMENT,
      parentId: null,
      inArea: false,
    });

  const actions = useMemo<TargetActions>(
    () => ({
      onEdit: (target) => {
        setEditingTarget(target);
        setDuplicateSource(null);
        setFormOpen(true);
      },
      onDuplicate: (target) => {
        setEditingTarget(null);
        setDuplicateSource(target);
        setFormOpen(true);
      },
      onDelete: (target) => {
        setIsDeleting(false);
        setDeleteTarget(target);
      },
    }),
    [],
  );

  const addToArea = useCallback(
    (area: TargetResponse) => {
      setAreaOpen(area.id, true);
      openCreateForm({
        kind: TARGET_KIND.EQUIPMENT,
        parentId: area.id,
        inArea: true,
      });
    },
    [openCreateForm, setAreaOpen],
  );

  const reparentSelected = async (parentId: string | null) => {
    // A component cannot leave its room, so "Make standalone" passes over it.
    const changes = selectedItems.filter(
      (item) =>
        item.parentId !== parentId &&
        item.id !== parentId &&
        !(parentId === null && item.kind === TARGET_KIND.COMPONENT),
    );
    setIsBulkPending(true);
    const results = await Promise.allSettled(
      changes.map((item) =>
        update.mutateAsync({
          id: item.id,
          input: {
            name: item.name,
            kind: item.kind,
            parentId,
            limits: item.limits,
          },
        }),
      ),
    );
    setIsBulkPending(false);

    const done = results.filter((result) => result.status === "fulfilled");
    const failure = results.find((result) => result.status === "rejected");
    if (done.length > 0) {
      toast.success(
        parentId
          ? t("selection.moved", { count: done.length })
          : t("selection.madeStandalone", { count: done.length }),
      );
    }
    if (failure) showApiError(failure.reason);
    clearSelection();
    if (parentId) setAreaOpen(parentId, true);
  };

  const deleteSelected = async () => {
    if (isBulkPending) return;
    setIsBulkPending(true);
    const results: PromiseSettledResult<void>[] = [];
    for (const wave of deletion.waves) {
      results.push(
        ...(await Promise.allSettled(
          wave.map((item) => remove.mutateAsync(item.id)),
        )),
      );
    }
    await refetch();
    setIsBulkPending(false);
    setBulkDeleteOpen(false);

    const done = results.filter((result) => result.status === "fulfilled");
    const failure = results.find((result) => result.status === "rejected");
    if (done.length > 0) {
      toast.success(t("selection.deleted", { count: done.length }));
    }
    if (failure) showApiError(failure.reason);
    clearSelection();
  };

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await remove.mutateAsync(deleteTarget.id);
      await refetch();
      toast.success(t("toast.deleteSuccess"));
      setDeleteTarget(null);
    } catch (error) {
      setIsDeleting(false);
      showApiError(error);
    }
  }, [deleteTarget, isDeleting, refetch, remove, showApiError, t]);

  // Only clear `open` — clearing the record mid-exit would swap the dialog's content.
  const handleFormOpenChange = useCallback((open: boolean) => {
    if (!open) setFormOpen(false);
  }, []);

  const handleSubmit = useCallback(
    async (values: TargetInput, copyContents: boolean) => {
      if (editingTarget) {
        await update.mutateAsync({ id: editingTarget.id, input: values });
        toast.success(t("toast.updateSuccess"));
        return;
      }

      if (duplicateSource && copyContents) {
        const contents = planContentsCopy(
          items,
          duplicateSource.id,
          values,
          (name, attempt) =>
            attempt === 1
              ? t("duplicateSuggestedName", { name })
              : t("duplicateSuggestedNameNumbered", { name, number: attempt }),
        );
        await duplicate.mutateAsync({
          sourceId: duplicateSource.id,
          input: { target: values, contents },
        });
      } else {
        await create.mutateAsync(values);
      }
      toast.success(
        duplicateSource
          ? t("toast.duplicateSuccess")
          : t("toast.createSuccess", { name: values.name }),
      );
    },
    [create, duplicate, duplicateSource, editingTarget, items, t, update],
  );

  const selectionActionsProps = {
    count: selectedIds.size,
    destinations,
    canMakeStandalone: selectedItems.some(
      (item) => item.parentId !== null && item.kind !== TARGET_KIND.COMPONENT,
    ),
    canDelete: deletableCount > 0,
    isPending: isBulkPending,
    onMove: (areaId: string) => void reparentSelected(areaId),
    onMakeStandalone: () => void reparentSelected(null),
    onDelete: () => setBulkDeleteOpen(true),
    onClear: clearSelection,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {mobileSelecting ? null : (
        <MobileHeaderAddAction label={t("add")} onClick={openAdd} />
      )}

      <PageHeader
        title={
          mobileSelecting
            ? t("selection.count", { count: selectedIds.size })
            : t("title")
        }
        description={t("description")}
        actions={
          mobileSelecting ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label={t("selection.clear")}
              onClick={clearSelection}
            >
              <XIcon className="size-5" />
            </Button>
          ) : null
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="size-8" />
        </div>
      ) : isError ? (
        <ApiQueryError error={error} onRetry={() => void refetch()} />
      ) : items.length === 0 ? (
        <TargetsOnboarding
          onAddArea={() =>
            openCreateForm({
              kind: TARGET_KIND.AREA,
              parentId: null,
              inArea: false,
            })
          }
          onAddLooseEquipment={() =>
            openCreateForm({
              kind: TARGET_KIND.EQUIPMENT,
              parentId: null,
              inArea: false,
            })
          }
        />
      ) : (
        <section
          aria-label={t("title")}
          className="flex min-w-0 flex-1 flex-col gap-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onSearch={setQuery}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchPlaceholder")}
              className="h-(--control-h) w-full bg-card sm:w-[250px]"
            />
            {hasAreas ? (
              <ScopeFilter value={activeScope} onChange={changeScope} />
            ) : null}
            {isMobile ? null : (
              <div className="ms-auto flex min-w-0 items-center gap-2">
                {selectedIds.size > 0 ? (
                  <SelectionActions
                    variant="inline"
                    {...selectionActionsProps}
                  />
                ) : (
                  <Button type="button" onClick={openAdd}>
                    <PlusIcon data-icon="inline-start" />
                    {t("add")}
                  </Button>
                )}
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {query.trim() ? t("noResults") : t("emptyEquipment")}
            </p>
          ) : (
            <TargetList
              rows={
                mobileSelecting
                  ? rows.filter((row) => row.type === "item")
                  : rows
              }
              itemsById={itemsById}
              childCounts={childCounts}
              flat={activeScope === "equipment"}
              isMobile={isMobile}
              showCheckboxes={!isMobile || mobileSelecting}
              selected={selectedIds}
              onToggleSelected={toggleSelected}
              onToggleAll={toggleAll}
              onLongPress={(id) => setSelected(new Set([id]))}
              isOpen={isOpen}
              onOpenChange={setAreaOpen}
              onAddToArea={addToArea}
              actions={actions}
            />
          )}

          {mobileSelecting ? (
            <SelectionActions variant="bar" {...selectionActionsProps} />
          ) : null}
        </section>
      )}

      <ResponsiveAlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
        title={t(
          deleteTarget?.kind === TARGET_KIND.AREA
            ? "deleteDialog.areaTitle"
            : deleteTarget?.kind === TARGET_KIND.COMPONENT
              ? "deleteDialog.componentTitle"
              : "deleteDialog.equipmentTitle",
        )}
        description={
          deleteTarget
            ? t("deleteConfirm", { name: deleteTarget.name })
            : t("deleteDialog.fallback")
        }
        cancelLabel={t("deleteDialog.cancel")}
        confirmLabel={t("deleteDialog.confirm")}
        confirmIcon={<Trash2Icon data-icon="inline-start" />}
        isLoading={isDeleting}
        cancelDisabled={isDeleting}
        onConfirm={confirmDelete}
      />

      <ResponsiveAlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open && !isBulkPending) setBulkDeleteOpen(false);
        }}
        title={t("selection.deleteTitle", { count: deletableCount })}
        description={
          deletion.kept.length > 0
            ? `${t("selection.deleteDescription")} ${t("selection.deleteKept", {
                count: deletion.kept.length,
                names: deletion.kept.map((item) => item.name).join(", "),
              })}`
            : t("selection.deleteDescription")
        }
        cancelLabel={t("deleteDialog.cancel")}
        confirmLabel={t("deleteDialog.confirm")}
        confirmIcon={<Trash2Icon data-icon="inline-start" />}
        isLoading={isBulkPending}
        cancelDisabled={isBulkPending}
        onConfirm={() => void deleteSelected()}
      />

      <TargetsForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        target={editingTarget}
        duplicateSource={duplicateSource}
        suggestedDuplicateName={
          duplicateSource
            ? t("duplicateSuggestedName", { name: duplicateSource.name })
            : undefined
        }
        defaults={formDefaults}
        items={items}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
