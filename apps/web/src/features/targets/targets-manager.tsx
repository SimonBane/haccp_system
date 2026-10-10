"use client";

import type {
  TargetInput,
  TargetKind,
  TargetResponse,
  TargetTypeResponse,
} from "@haccp/shared";
import type { RowSelectionState } from "@tanstack/react-table";
import { Settings2Icon, ShapesIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiQueryError } from "@/components/api-query-error";
import {
  MobileHeaderAddAction,
  PageHeader,
} from "@/components/layout/page-header";
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { TargetTypesDialog } from "@/features/targets/components/target-types-dialog";
import { TargetsData } from "@/features/targets/data-table/data";
import { useTargetTypesQuery } from "@/features/targets/hooks/use-target-types-query";
import { useTargetsMutations } from "@/features/targets/hooks/use-targets-mutations";
import { useTargetsQuery } from "@/features/targets/hooks/use-targets-query";
import { TargetsForm } from "@/features/targets/targets-form";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";

type TargetsManagerProps = {
  initialItems: TargetResponse[];
  initialTypes: TargetTypeResponse[];
  initialLocationId: string;
};

export function TargetsManager({
  initialItems,
  initialTypes,
  initialLocationId,
}: TargetsManagerProps) {
  const t = useTranslations("TargetsPage");
  const showApiError = useApiErrorToast();
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTargetsQuery({ initialData: initialItems, initialLocationId });
  const { data: targetTypes = [] } = useTargetTypesQuery({
    initialData: initialTypes,
  });
  const { create, update, remove } = useTargetsMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<TargetResponse | null>(
    null,
  );
  const [duplicateSource, setDuplicateSource] = useState<TargetResponse | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<TargetResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  );

  const kindLabels = useMemo<Record<TargetKind, string>>(
    () => ({
      equipment: t("kinds.equipment"),
      area: t("kinds.area"),
      surface: t("kinds.surface"),
      vehicle: t("kinds.vehicle"),
    }),
    [t],
  );

  const openCreateForm = useCallback(() => {
    setEditingTarget(null);
    setDuplicateSource(null);
    setFormOpen(true);
  }, []);

  const openEditForm = useCallback((target: TargetResponse) => {
    setEditingTarget(target);
    setDuplicateSource(null);
    setFormOpen(true);
  }, []);

  const openDuplicateForm = useCallback((target: TargetResponse) => {
    setEditingTarget(null);
    setDuplicateSource(target);
    setFormOpen(true);
  }, []);

  const openTypes = useCallback(() => setTypesOpen(true), []);

  const handleDelete = useCallback((target: TargetResponse) => {
    setIsDeleting(false);
    setDeleteTarget(target);
  }, []);

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

  const handleBulkDelete = useCallback(() => {
    setDeleteTarget(null);
    setBulkDeleteOpen(true);
  }, []);

  const confirmBulkDelete = useCallback(async () => {
    if (isBulkDeleting || selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => remove.mutateAsync(id)));
      await refetch();
      toast.success(
        t("toast.bulkDeleteSuccess", { count: selectedIds.length }),
      );
      setRowSelection({});
      setBulkDeleteOpen(false);
    } catch (error) {
      showApiError(error);
    } finally {
      setIsBulkDeleting(false);
    }
  }, [isBulkDeleting, refetch, remove, selectedIds, showApiError, t]);

  // Only clear `open` — clearing the record mid-exit would swap the dialog's content.
  const handleFormOpenChange = useCallback((open: boolean) => {
    if (!open) setFormOpen(false);
  }, []);

  const handleSubmit = useCallback(
    async (values: TargetInput) => {
      if (editingTarget) {
        await update.mutateAsync({ id: editingTarget.id, input: values });
        toast.success(t("toast.updateSuccess"));
        return;
      }

      await create.mutateAsync(values);
      toast.success(
        duplicateSource
          ? t("toast.duplicateSuccess")
          : t("toast.createSuccess"),
      );
    },
    [create, duplicateSource, editingTarget, t, update],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <MobileHeaderAddAction label={t("add")} onClick={openCreateForm} />

      <PageHeader title={t("title")} description={t("description")} />

      {targetTypes.length === 0 ? (
        <Alert>
          <ShapesIcon />
          <AlertTitle>{t("noTypes.title")}</AlertTitle>
          <AlertDescription>{t("noTypes.description")}</AlertDescription>
          <AlertAction>
            <Button type="button" size="sm" onClick={openTypes}>
              <Settings2Icon data-icon="inline-start" />
              {t("manageTypes")}
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="size-8" />
        </div>
      ) : isError ? (
        <ApiQueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <TargetsData
          items={items}
          kindLabels={kindLabels}
          onAdd={openCreateForm}
          onManageTypes={openTypes}
          onEdit={openEditForm}
          onDuplicate={openDuplicateForm}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      )}

      <ResponsiveAlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
        title={t("deleteDialog.title")}
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
          if (!open && !isBulkDeleting) setBulkDeleteOpen(false);
        }}
        title={t("deleteDialog.bulkTitle")}
        description={t("bulkDeleteConfirm", { count: selectedIds.length })}
        cancelLabel={t("deleteDialog.cancel")}
        confirmLabel={t("deleteDialog.confirm")}
        confirmIcon={<Trash2Icon data-icon="inline-start" />}
        isLoading={isBulkDeleting}
        cancelDisabled={isBulkDeleting}
        onConfirm={confirmBulkDelete}
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
        targetTypes={targetTypes}
        existingItems={items.map((item) => ({ id: item.id, name: item.name }))}
        onManageTypes={openTypes}
        onSubmit={handleSubmit}
      />

      <TargetTypesDialog
        open={typesOpen}
        onOpenChange={setTypesOpen}
        types={targetTypes}
      />
    </div>
  );
}
