"use client";

import type {
  EquipmentResponse,
  TaskTemplateFieldsInput,
  TaskTemplateResponse,
} from "@haccp/shared";
import type { RowSelectionState } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import {
  MobileHeaderAddAction,
  PageHeader,
} from "@/components/layout/page-header";
import { useEquipmentOptions } from "@/features/equipment/hooks/use-equipment-query";
import { TaskTemplatesData } from "@/features/task-templates/data-table/data";
import { useTaskTemplatesMutations } from "@/features/task-templates/hooks/use-task-templates-mutations";
import { useTaskTemplatesQuery } from "@/features/task-templates/hooks/use-task-templates-query";
import { TaskTemplatesForm } from "@/features/task-templates/task-templates-form";
import { getErrorMessage } from "@/lib/api/get-error-message";

type TaskTemplatesManagerProps = {
  initialItems: TaskTemplateResponse[];
  /** Seeds the form's equipment select, so opening the dialog needs no request. */
  initialEquipment: EquipmentResponse[];
  initialLocationId: string;
};

export function TaskTemplatesManager({
  initialItems,
  initialEquipment,
  initialLocationId,
}: TaskTemplatesManagerProps) {
  const t = useTranslations("TasksPage");
  const { data: items = [], refetch } = useTaskTemplatesQuery({
    initialData: initialItems,
    initialLocationId,
  });
  const equipment = useEquipmentOptions({
    initialData: initialEquipment,
    initialLocationId,
  });
  const { create, update, remove } = useTaskTemplatesMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskTemplateResponse | null>(
    null,
  );
  const [duplicateSource, setDuplicateSource] =
    useState<TaskTemplateResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TaskTemplateResponse | null>(
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
    setEditingTask(null);
    setDuplicateSource(null);
    setFormOpen(true);
    setDeleteTarget(null);
  }, []);

  const openEditForm = useCallback((task: TaskTemplateResponse) => {
    setEditingTask(task);
    setDuplicateSource(null);
    setFormOpen(true);
    setDeleteTarget(null);
  }, []);

  const openDuplicateForm = useCallback((task: TaskTemplateResponse) => {
    setEditingTask(null);
    setDuplicateSource(task);
    setFormOpen(true);
    setDeleteTarget(null);
  }, []);

  const handleDelete = useCallback((task: TaskTemplateResponse) => {
    setIsDeleting(false);
    setDeleteTarget(task);
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
      toast.error(getErrorMessage(error, t("toast.bulkDeleteError")));
    } finally {
      setIsBulkDeleting(false);
    }
  }, [isBulkDeleting, refetch, remove, selectedIds, t]);

  // Only clear `open` — clearing the record remounts the form via `key` and kills the slide-out.
  const handleFormOpenChange = useCallback((open: boolean) => {
    if (!open) setFormOpen(false);
  }, []);

  const handleSubmit = useCallback(
    async (values: TaskTemplateFieldsInput) => {
      if (editingTask) {
        await update.mutateAsync({ id: editingTask.id, input: values });
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
    [create, duplicateSource, editingTask, t, update],
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <MobileHeaderAddAction label={t("add")} onClick={openCreateForm} />

      <PageHeader title={t("title")} description={t("description")} />

      <TaskTemplatesData
        items={items}
        onAdd={openCreateForm}
        onEdit={openEditForm}
        onDuplicate={openDuplicateForm}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
      />

      <ResponsiveAlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
        title={t("deleteDialog.title")}
        description={
          deleteTarget
            ? t("deleteConfirm", { title: deleteTarget.title })
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

      <TaskTemplatesForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        task={editingTask}
        duplicateSource={duplicateSource}
        suggestedDuplicateTitle={
          duplicateSource
            ? t("duplicateSuggestedTitle", { title: duplicateSource.title })
            : undefined
        }
        equipment={equipment}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
