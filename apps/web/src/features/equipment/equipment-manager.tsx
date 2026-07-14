"use client";

import type { EquipmentResponse } from "@haccp/shared";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EquipmentForm } from "@/features/equipment/equipment-form";
import { EquipmentData } from "@/features/equipment/data-table/data";
import { useEquipmentApi } from "@/features/equipment/use-equipment-api";

function suggestDuplicateName(
  sourceName: string,
  existingNames: string[],
): string {
  const base = `${sourceName} (Copy)`;
  if (!existingNames.includes(base)) return base;
  let i = 2;
  while (existingNames.includes(`${sourceName} (Copy ${i})`)) i++;
  return `${sourceName} (Copy ${i})`;
}

type EquipmentManagerProps = {
  initialItems: EquipmentResponse[];
};

export function EquipmentManager({ initialItems }: EquipmentManagerProps) {
  const t = useTranslations("EquipmentPage");
  const { create, update, remove } = useEquipmentApi();

  const [items, setItems] = useState(initialItems);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] =
    useState<EquipmentResponse | null>(null);
  const [duplicateSource, setDuplicateSource] =
    useState<EquipmentResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EquipmentResponse | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  function openCreateForm() {
    setEditingEquipment(null);
    setDuplicateSource(null);
    setFormOpen(true);
    setIsDeleting(false);
    setDeleteTarget(null);
  }

  function openEditForm(equipment: EquipmentResponse) {
    setEditingEquipment(equipment);
    setDuplicateSource(null);
    setFormOpen(true);
    setIsDeleting(false);
    setDeleteTarget(null);
  }

  function openDuplicateForm(equipment: EquipmentResponse) {
    setEditingEquipment(null);
    setDuplicateSource(equipment);
    setFormOpen(true);
    setIsDeleting(false);
    setDeleteTarget(null);
  }

  function handleDelete(equipment: EquipmentResponse) {
    setIsDeleting(false);
    setDeleteTarget(equipment);
  }

  async function confirmDelete() {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    const target = deleteTarget;
    try {
      await remove(target.id);
      setItems((current) =>
        current.filter((item) => item.id !== target.id),
      );
      toast.success(t("toast.deleteSuccess", { name: target.name }));
      setDeleteTarget(null);
    } catch {
      toast.error(t("toast.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <EquipmentData
        items={items}
        onAdd={openCreateForm}
        onEdit={openEditForm}
        onDuplicate={openDuplicateForm}
        onDelete={handleDelete}
      />

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t("deleteConfirm", { name: deleteTarget.name })
                : t("deleteDialog.fallback")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("deleteDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              isLoading={isDeleting}
              onClick={confirmDelete}
            >
              <Trash2Icon data-icon="inline-start" />
              {t("deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {formOpen ? (
        <EquipmentForm
          key={
            duplicateSource
              ? `duplicate-${duplicateSource.id}`
              : (editingEquipment?.id ?? "create")
          }
          open
          onOpenChange={(open) => {
            if (!open) {
              setFormOpen(false);
              setEditingEquipment(null);
              setDuplicateSource(null);
            }
          }}
          equipment={editingEquipment}
          duplicateSource={duplicateSource}
          suggestedDuplicateName={
            duplicateSource
              ? suggestDuplicateName(
                  duplicateSource.name,
                  items.map((item) => item.name),
                )
              : undefined
          }
          existingItems={items.map((item) => ({
            id: item.id,
            name: item.name,
          }))}
          onDuplicate={() => {
            if (editingEquipment) openDuplicateForm(editingEquipment);
          }}
          onSubmit={async (values) => {
            if (editingEquipment) {
              const updated = await update(editingEquipment.id, values);
              setItems((current) =>
                current.map((item) =>
                  item.id === updated.id ? updated : item,
                ),
              );
              return;
            }

            const created = await create(values);
            setItems((current) => [...current, created]);
            toast.success(
              duplicateSource
                ? t("toast.duplicateSuccess", { name: created.name })
                : t("toast.createSuccess", { name: created.name }),
            );
          }}
        />
      ) : null}
    </div>
  );
}
