"use client";

import type {
  EquipmentResponse,
  TaskTemplateFieldsInput,
  TaskTemplateResponse,
} from "@haccp/shared";
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
import { TaskTemplatesData } from "@/features/task-templates/data-table/data";
import { TaskTemplatesForm } from "@/features/task-templates/task-templates-form";
import { useTaskTemplatesApi } from "@/features/task-templates/hooks/use-task-templates-api";

type TaskTemplatesManagerProps = {
  initialItems: TaskTemplateResponse[];
  equipment: Pick<EquipmentResponse, "id" | "name">[];
};

export function TaskTemplatesManager({
  initialItems,
  equipment,
}: TaskTemplatesManagerProps) {
  const t = useTranslations("TasksPage");
  const { create, update, remove } = useTaskTemplatesApi();

  const [items, setItems] = useState(initialItems);
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

  function openCreateForm() {
    setEditingTask(null);
    setDuplicateSource(null);
    setFormOpen(true);
    setIsDeleting(false);
    setDeleteTarget(null);
  }

  function openEditForm(task: TaskTemplateResponse) {
    setEditingTask(task);
    setDuplicateSource(null);
    setFormOpen(true);
    setIsDeleting(false);
    setDeleteTarget(null);
  }

  function openDuplicateForm(task: TaskTemplateResponse) {
    setEditingTask(null);
    setDuplicateSource(task);
    setFormOpen(true);
    setIsDeleting(false);
    setDeleteTarget(null);
  }

  function handleDelete(task: TaskTemplateResponse) {
    setIsDeleting(false);
    setDeleteTarget(task);
  }

  async function confirmDelete() {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    const target = deleteTarget;
    try {
      await remove(target.id);
      setItems((current) => current.filter((item) => item.id !== target.id));
      toast.success(t("toast.deleteSuccess"));
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

      <TaskTemplatesData
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
                ? t("deleteConfirm", { title: deleteTarget.title })
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
        <TaskTemplatesForm
          key={
            duplicateSource
              ? `duplicate-${duplicateSource.id}`
              : (editingTask?.id ?? "create")
          }
          open
          onOpenChange={(open) => {
            if (!open) {
              setFormOpen(false);
              setEditingTask(null);
              setDuplicateSource(null);
            }
          }}
          task={editingTask}
          duplicateSource={duplicateSource}
          suggestedDuplicateTitle={
            duplicateSource
              ? t("duplicateSuggestedTitle", { title: duplicateSource.title })
              : undefined
          }
          equipment={equipment}
          onDuplicate={() => {
            if (editingTask) openDuplicateForm(editingTask);
          }}
          onSubmit={async (values) => {
            if (editingTask) {
              const updated = await update(editingTask.id, values);
              setItems((current) =>
                current.map((item) => (item.id === updated.id ? updated : item)),
              );
              toast.success(t("toast.updateSuccess"));
              return;
            }

            const created = await create(values as TaskTemplateFieldsInput);
            setItems((current) => [...current, created]);
            toast.success(
              duplicateSource
                ? t("toast.duplicateSuccess")
                : t("toast.createSuccess"),
            );
          }}
        />
      ) : null}
    </div>
  );
}
