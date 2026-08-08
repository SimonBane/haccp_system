"use client";

import type { LocationResponse } from "@haccp/shared";
import { tenantContextResponseSchema } from "@haccp/shared";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { MobileHeaderAddButton } from "@/components/layout/mobile-header-add-button";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { LocationsData } from "@/features/locations/data-table/data";
import { useLocationsMutations } from "@/features/locations/hooks/use-locations-mutations";
import { useLocationsQuery } from "@/features/locations/hooks/use-locations-query";
import { LocationForm } from "@/features/locations/location-form";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/get-error-message";

type LocationsManagerProps = {
  initialItems: LocationResponse[];
};

export function LocationsManager({ initialItems }: LocationsManagerProps) {
  const t = useTranslations("LocationsPage");
  const { fetchJson } = useAuthenticatedFetch();
  const { refreshTenant } = useTenant();
  const { data: items = [], refetch } = useLocationsQuery({
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

  const refreshTenantContext = useCallback(async () => {
    const tenant = await fetchJson("/tenant/current", tenantContextResponseSchema);
    refreshTenant(tenant);
  }, [fetchJson, refreshTenant]);

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
        await refreshTenantContext();
        toast.success(t("toast.setDefaultSuccess", { name: location.name }));
      } catch (error) {
        toast.error(getErrorMessage(error, t("errors.generic")));
      } finally {
        setSettingDefaultId(null);
      }
    },
    [refreshTenantContext, refetch, settingDefaultId, t, update],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    const target = deleteTarget;
    setIsDeleting(true);

    try {
      await remove.mutateAsync(target.id);
      await refetch();
      await refreshTenantContext();
      toast.success(t("toast.deleteSuccess"));
      setDeleteTarget(null);
    } catch (error) {
      setIsDeleting(false);
      toast.error(getErrorMessage(error, t("toast.deleteError")));
    }
  }, [
    deleteTarget,
    isDeleting,
    refreshTenantContext,
    refetch,
    remove,
    t,
  ]);

  const handleFormOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setFormOpen(false);
      setEditingLocation(null);
    }
  }, []);

  const handleSubmit = useCallback(
    async (values: { name: string }) => {
      if (editingLocation) {
        await update.mutateAsync({
          id: editingLocation.id,
          input: { name: values.name },
        });
        await refetch();
        await refreshTenantContext();
        toast.success(t("toast.renameSuccess"));
        return;
      }

      await create.mutateAsync({ name: values.name });
      await refetch();
      await refreshTenantContext();
      toast.success(t("toast.createSuccess"));
    },
    [create, editingLocation, refreshTenantContext, refetch, t, update],
  );

  return (
    <div className="space-y-6">
      <MobileHeaderAddButton label={t("add")} onClick={openCreateForm} />

      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <LocationsData
        items={items}
        settingDefaultId={settingDefaultId}
        onAdd={openCreateForm}
        onRename={openRenameForm}
        onDelete={handleDelete}
        onSetDefault={handleSetDefault}
      />

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

      {formOpen ? (
        <LocationForm
          key={editingLocation?.id ?? "create"}
          open
          onOpenChange={handleFormOpenChange}
          location={editingLocation}
          onSubmit={handleSubmit}
        />
      ) : null}
    </div>
  );
}
