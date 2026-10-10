"use client";

import type { FormCategory, FormResponse, StarterForm } from "@haccp/shared";
import { FORM_CATEGORY_VALUES } from "@haccp/shared";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiQueryError } from "@/components/api-query-error";
import {
  MobileHeaderAddAction,
  PageHeader,
} from "@/components/layout/page-header";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  FormBuilderDialog,
  type FormBuilderMode,
} from "@/features/forms/components/builder/form-builder-dialog";
import { NewFormDialog } from "@/features/forms/components/new-form-dialog";
import { FormsData } from "@/features/forms/data-table/data";
import { useFormsMutations } from "@/features/forms/hooks/use-forms-mutations";
import { useFormsQuery } from "@/features/forms/hooks/use-forms-query";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";

type FormsManagerProps = {
  initialItems: FormResponse[];
};

export function FormsManager({ initialItems }: FormsManagerProps) {
  const t = useTranslations("FormsPage");
  const tForms = useTranslations("Forms");
  const showApiError = useApiErrorToast();
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useFormsQuery({ initialData: initialItems });
  const { remove } = useFormsMutations();

  const [chooserOpen, setChooserOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderMode, setBuilderMode] = useState<FormBuilderMode>({
    kind: "create",
    source: null,
  });
  const [deleteTarget, setDeleteTarget] = useState<FormResponse | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const categoryLabels = useMemo(
    () =>
      Object.fromEntries(
        FORM_CATEGORY_VALUES.map((category) => [
          category,
          tForms(`categories.${category}`),
        ]),
      ) as Record<FormCategory, string>,
    [tForms],
  );

  const openBuilder = useCallback((mode: FormBuilderMode) => {
    setBuilderMode(mode);
    setBuilderOpen(true);
  }, []);

  const openChooser = useCallback(() => setChooserOpen(true), []);

  const handlePick = useCallback(
    (source: StarterForm | null) => {
      setChooserOpen(false);
      openBuilder({ kind: "create", source });
    },
    [openBuilder],
  );

  const handleEdit = useCallback(
    (form: FormResponse) => openBuilder({ kind: "edit", form }),
    [openBuilder],
  );

  const handleDuplicate = useCallback(
    (form: FormResponse) =>
      openBuilder({
        kind: "create",
        source: {
          key: form.id,
          name: t("duplicateSuggestedName", { name: form.name }),
          category: form.category,
          definition: form.latestVersion.definition,
        },
      }),
    [openBuilder, t],
  );

  const handleDelete = useCallback((form: FormResponse) => {
    setIsDeleting(false);
    setDeleteTarget(form);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success(t("toast.deleteSuccess"));
      setDeleteTarget(null);
    } catch (error) {
      showApiError(error);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, isDeleting, remove, showApiError, t]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <MobileHeaderAddAction label={t("add")} onClick={openChooser} />

      <PageHeader title={t("title")} description={t("description")} />

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="size-8" />
        </div>
      ) : isError ? (
        <ApiQueryError error={error} onRetry={() => void refetch()} />
      ) : (
        <FormsData
          items={items}
          categoryLabels={categoryLabels}
          onAdd={openChooser}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      )}

      <ResponsiveAlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
        title={t("deleteDialog.title")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        cancelLabel={t("deleteDialog.cancel")}
        confirmLabel={t("deleteDialog.confirm")}
        confirmIcon={<Trash2Icon data-icon="inline-start" />}
        isLoading={isDeleting}
        cancelDisabled={isDeleting}
        onConfirm={confirmDelete}
      />

      <NewFormDialog
        open={chooserOpen}
        onOpenChange={setChooserOpen}
        onPick={handlePick}
      />

      <FormBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        mode={builderMode}
      />
    </div>
  );
}
