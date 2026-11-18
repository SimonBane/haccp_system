"use client";

import type { FormListItem, TaskTemplateResponse } from "@haccp/shared";
import type { RowSelectionState } from "@tanstack/react-table";
import { ChartGanttIcon, ListIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiQueryError } from "@/components/api-query-error";
import {
  MobileHeaderAddAction,
  PageHeader,
} from "@/components/layout/page-header";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFormsQuery } from "@/features/forms/hooks/use-forms-query";
import { DayPlan } from "@/features/task-templates/components/day-plan";
import { TaskTemplatesData } from "@/features/task-templates/data-table/data";
import { useTaskTemplatesMutations } from "@/features/task-templates/hooks/use-task-templates-mutations";
import { useTaskTemplatesQuery } from "@/features/task-templates/hooks/use-task-templates-query";
import { useRouter } from "@/i18n/navigation";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";

const TASKS_PATH = "/dashboard/task-templates";
const HIGHLIGHT_MS = 5000;

type View = "list" | "plan";

type TaskTemplatesManagerProps = {
  initialItems: TaskTemplateResponse[];
  initialForms: FormListItem[];
  initialLocationId: string;
  /** The task just saved by the builder, highlighted for a moment. */
  savedId: string | null;
};

export function TaskTemplatesManager({
  initialItems,
  initialForms,
  initialLocationId,
  savedId,
}: TaskTemplatesManagerProps) {
  const t = useTranslations("TasksPage");
  const router = useRouter();
  const showApiError = useApiErrorToast();
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTaskTemplatesQuery({ initialData: initialItems, initialLocationId });
  const { data: forms = [] } = useFormsQuery({ initialData: initialForms });
  const { remove } = useTaskTemplatesMutations();

  const [view, setView] = useState<View>("list");
  const [highlightId, setHighlightId] = useState(savedId);
  const [deleteTarget, setDeleteTarget] = useState<TaskTemplateResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  );

  useEffect(() => {
    if (!savedId) return;
    router.replace(TASKS_PATH, { scroll: false });
    const timer = setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [savedId, router]);

  const appliesToById = useMemo(
    () => new Map(forms.map((form) => [form.id, form.appliesTo])),
    [forms],
  );
  const appliesToOf = useCallback(
    (task: TaskTemplateResponse) => appliesToById.get(task.formId) ?? null,
    [appliesToById],
  );

  const openNew = useCallback(() => router.push(`${TASKS_PATH}/new`), [router]);
  const openEdit = useCallback(
    (task: TaskTemplateResponse) => router.push(`${TASKS_PATH}/${task.id}`),
    [router],
  );
  const openDuplicate = useCallback(
    (task: TaskTemplateResponse) => router.push(`${TASKS_PATH}/new?from=${task.id}`),
    [router],
  );

  const handleDelete = useCallback((task: TaskTemplateResponse) => {
    setIsDeleting(false);
    setDeleteTarget(task);
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

  const confirmBulkDelete = useCallback(async () => {
    if (isBulkDeleting || selectedIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all(selectedIds.map((id) => remove.mutateAsync(id)));
      await refetch();
      toast.success(t("toast.bulkDeleteSuccess", { count: selectedIds.length }));
      setRowSelection({});
      setBulkDeleteOpen(false);
    } catch (error) {
      showApiError(error);
    } finally {
      setIsBulkDeleting(false);
    }
  }, [isBulkDeleting, refetch, remove, selectedIds, showApiError, t]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <MobileHeaderAddAction label={t("add")} onClick={openNew} />

      <PageHeader title={t("title")} description={t("description")} />

      <Tabs value={view} onValueChange={(next) => setView(next as View)}>
        <TabsList variant="line" aria-label={t("views.label")}>
          <TabsTrigger value="list">
            <ListIcon aria-hidden />
            {t("views.list")}
          </TabsTrigger>
          <TabsTrigger value="plan">
            <ChartGanttIcon aria-hidden />
            {t("views.plan")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="size-8" />
        </div>
      ) : isError ? (
        <ApiQueryError error={error} onRetry={() => void refetch()} />
      ) : view === "plan" ? (
        <DayPlan items={items} appliesToOf={appliesToOf} onEdit={openEdit} />
      ) : (
        <TaskTemplatesData
          items={items}
          appliesToOf={appliesToOf}
          highlightId={highlightId}
          onAdd={openNew}
          onEdit={openEdit}
          onDuplicate={openDuplicate}
          onDelete={handleDelete}
          onBulkDelete={() => {
            setDeleteTarget(null);
            setBulkDeleteOpen(true);
          }}
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
    </div>
  );
}
