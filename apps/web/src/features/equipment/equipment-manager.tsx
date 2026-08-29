"use client";

import type { EquipmentResponse } from "@haccp/shared";
import type { RowSelectionState } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiQueryError } from "@/components/api-query-error";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  MobileHeaderAddAction,
  PageHeader,
} from "@/components/layout/page-header";
import { EquipmentForm } from "@/features/equipment/equipment-form";
import { EquipmentData } from "@/features/equipment/data-table/data";
import { useEquipmentMutations } from "@/features/equipment/hooks/use-equipment-mutations";
import { useEquipmentQuery } from "@/features/equipment/hooks/use-equipment-query";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";

type EquipmentManagerProps = {
  initialItems: EquipmentResponse[];
  initialLocationId: string;
};

export function EquipmentManager({
  initialItems,
  initialLocationId,
}: EquipmentManagerProps) {
  const t = useTranslations("EquipmentPage");
  const showApiError = useApiErrorToast();
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useEquipmentQuery({
    initialData: initialItems,
    initialLocationId,
  });
  const { create, update, remove } = useEquipmentMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] =
    useState<EquipmentResponse | null>(null);
  const [duplicateSource, setDuplicateSource] =
    useState<EquipmentResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentResponse | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  );

  const openCreateForm = useCallback(() => {
    setEditingEquipment(null);
    setDuplicateSource(null);
    setFormOpen(true);
    setDeleteTarget(null);
  }, []);

  const openEditForm = useCallback((equipment: EquipmentResponse) => {
    setEditingEquipment(equipment);
    setDuplicateSource(null);
    setFormOpen(true);
    setDeleteTarget(null);
  }, []);

  const openDuplicateForm = useCallback((equipment: EquipmentResponse) => {
    setEditingEquipment(null);
    setDuplicateSource(equipment);
    setFormOpen(true);
    setDeleteTarget(null);
  }, []);

  const handleDelete = useCallback((equipment: EquipmentResponse) => {
    setIsDeleting(false);
    setDeleteTarget(equipment);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    const target = deleteTarget;
    setIsDeleting(true);
    try {
      await remove.mutateAsync(target.id);
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

  // Only clear `open` — clearing the record remounts the form via `key` and kills the slide-out.
  const handleFormOpenChange = useCallback((open: boolean) => {
    if (!open) setFormOpen(false);
  }, []);

  const handleSubmit = useCallback(
    async (values: Parameters<typeof create.mutateAsync>[0]) => {
      if (editingEquipment) {
        await update.mutateAsync({ id: editingEquipment.id, input: values });
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
    [create, duplicateSource, editingEquipment, t, update],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <MobileHeaderAddAction label={t("add")} onClick={openCreateForm} />

      <PageHeader title={t("title")} description={t("description")} />

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="size-8" />
        </div>
      ) : isError ? (
        <ApiQueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <EquipmentData
          items={items}
          onAdd={openCreateForm}
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

      <EquipmentForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        equipment={editingEquipment}
        duplicateSource={duplicateSource}
        suggestedDuplicateName={
          duplicateSource
            ? t("duplicateSuggestedName", { name: duplicateSource.name })
            : undefined
        }
        existingItems={items.map((item) => ({
          id: item.id,
          name: item.name,
        }))}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
