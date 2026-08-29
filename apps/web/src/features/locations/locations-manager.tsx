"use client";

import type { LocationResponse } from "@haccp/shared";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ApiQueryError } from "@/components/api-query-error";
import {
  MobileHeaderAddAction,
  PageHeader,
} from "@/components/layout/page-header";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { LocationsData } from "@/features/locations/data-table/data";
import { useLocationsMutations } from "@/features/locations/hooks/use-locations-mutations";
import { useLocationsQuery } from "@/features/locations/hooks/use-locations-query";
import { LocationForm } from "@/features/locations/location-form";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";

type LocationsManagerProps = {
  initialItems: LocationResponse[];
};

export function LocationsManager({ initialItems }: LocationsManagerProps) {
  const t = useTranslations("LocationsPage");
  const showApiError = useApiErrorToast();
  const { reloadTenant } = useTenant();
  const {
    data: items = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useLocationsQuery({
    initialData: initialItems,
  });
  const { create, update, remove } = useLocationsMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editingLocation, setEditingLocation] =
    useState<LocationResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocationResponse | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

  const openCreateForm = useCallback(() => {
    setEditingLocation(null);
    setFormOpen(true);
    setDeleteTarget(null);
  }, []);

  const openRenameForm = useCallback((location: LocationResponse) => {
    setEditingLocation(location);
    setFormOpen(true);
    setDeleteTarget(null);
  }, []);

  const handleDelete = useCallback((location: LocationResponse) => {
    setIsDeleting(false);
    setDeleteTarget(location);
  }, []);

  const handleSetDefault = useCallback(
    async (location: LocationResponse) => {
      if (location.isDefault || settingDefaultId) {
        return;
      }

      setSettingDefaultId(location.id);

      try {
        await update.mutateAsync({
          id: location.id,
          input: { isDefault: true },
        });
        await refetch();
        await reloadTenant();
        toast.success(t("toast.setDefaultSuccess", { name: location.name }));
      } catch (error) {
        showApiError(error);
      } finally {
        setSettingDefaultId(null);
      }
    },
    [reloadTenant, refetch, settingDefaultId, showApiError, t, update],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    const target = deleteTarget;
    setIsDeleting(true);

    try {
      await remove.mutateAsync(target.id);
      await refetch();
      await reloadTenant();
      toast.success(t("toast.deleteSuccess"));
      setDeleteTarget(null);
    } catch (error) {
      setIsDeleting(false);
      showApiError(error);
    }
  }, [
    deleteTarget,
    isDeleting,
    reloadTenant,
    refetch,
    remove,
    showApiError,
    t,
  ]);

  // Only clear `open` — clearing the record remounts the form via `key` and kills the slide-out.
  const handleFormOpenChange = useCallback((open: boolean) => {
    if (!open) setFormOpen(false);
  }, []);

  const handleSubmit = useCallback(
    async (values: { name: string }) => {
      if (editingLocation) {
        await update.mutateAsync({
          id: editingLocation.id,
          input: { name: values.name },
        });
        await refetch();
        await reloadTenant();
        toast.success(t("toast.renameSuccess"));
        return;
      }

      await create.mutateAsync({ name: values.name });
      await refetch();
      await reloadTenant();
      toast.success(t("toast.createSuccess"));
    },
    [create, editingLocation, reloadTenant, refetch, t, update],
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
        <LocationsData
          items={items}
          settingDefaultId={settingDefaultId}
          onAdd={openCreateForm}
          onRename={openRenameForm}
          onDelete={handleDelete}
          onSetDefault={handleSetDefault}
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
            ? t("deleteDialog.confirm", { name: deleteTarget.name })
            : t("deleteDialog.fallback")
        }
        cancelLabel={t("deleteDialog.cancel")}
        cancelDisabled={isDeleting}
        confirmLabel={t("deleteDialog.confirmAction")}
        confirmIcon={<Trash2Icon data-icon="inline-start" />}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />

      <LocationForm
        open={formOpen}
        onOpenChange={handleFormOpenChange}
        location={editingLocation}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
