"use client";

import type { EquipmentResponse } from "@haccp/shared";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { MobileHeaderAddButton } from "@/components/layout/mobile-header-add-button";
import { EquipmentForm } from "@/features/equipment/equipment-form";
import { EquipmentData } from "@/features/equipment/data-table/data";
import { useEquipmentMutations } from "@/features/equipment/hooks/use-equipment-mutations";
import { useEquipmentQuery } from "@/features/equipment/hooks/use-equipment-query";
import { getErrorMessage } from "@/lib/api/get-error-message";

type EquipmentManagerProps = {
  initialItems: EquipmentResponse[];
  initialLocationId: string;
};

export function EquipmentManager({
  initialItems,
  initialLocationId,
}: EquipmentManagerProps) {
  const t = useTranslations("EquipmentPage");
  const { data: items = [], refetch } = useEquipmentQuery({
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
      toast.error(getErrorMessage(error, t("toast.deleteError")));
    }
  }, [deleteTarget, isDeleting, refetch, remove, t]);

  const handleFormOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setFormOpen(false);
      setEditingEquipment(null);
      setDuplicateSource(null);
    }
  }, []);

  const handleDuplicateFromForm = useCallback(() => {
    if (editingEquipment) openDuplicateForm(editingEquipment);
  }, [editingEquipment, openDuplicateForm]);

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
    <div className="space-y-6">
      <MobileHeaderAddButton label={t("add")} onClick={openCreateForm} />

      <div className="hidden md:block">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <EquipmentData
        items={items}
        onAdd={openCreateForm}
        onEdit={openEditForm}
        onDuplicate={openDuplicateForm}
        onDelete={handleDelete}
      />

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

      {formOpen ? (
        <EquipmentForm
          key={
            duplicateSource
              ? `duplicate-${duplicateSource.id}`
              : (editingEquipment?.id ?? "create")
          }
          open
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
          onDuplicate={handleDuplicateFromForm}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
