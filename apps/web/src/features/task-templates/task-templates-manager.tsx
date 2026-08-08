"use client";

import type {
  EquipmentResponse,
  TaskTemplateFieldsInput,
  TaskTemplateResponse,
} from "@haccp/shared";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { MobileHeaderAddButton } from "@/components/layout/mobile-header-add-button";
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

  const handleFormOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setFormOpen(false);
      setEditingTask(null);
      setDuplicateSource(null);
    }
  }, []);

  const handleDuplicateFromForm = useCallback(() => {
    if (editingTask) openDuplicateForm(editingTask);
  }, [editingTask, openDuplicateForm]);

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
    <div className="space-y-6">
      <MobileHeaderAddButton label={t("add")} onClick={openCreateForm} />

      <div className="hidden md:block">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <TaskTemplatesData
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

      {formOpen ? (
        <TaskTemplatesForm
          key={
            duplicateSource
              ? `duplicate-${duplicateSource.id}`
              : (editingTask?.id ?? "create")
          }
          open
          onOpenChange={handleFormOpenChange}
          task={editingTask}
          duplicateSource={duplicateSource}
          suggestedDuplicateTitle={
            duplicateSource
              ? t("duplicateSuggestedTitle", { title: duplicateSource.title })
              : undefined
          }
          equipment={equipment}
          onDuplicate={handleDuplicateFromForm}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
