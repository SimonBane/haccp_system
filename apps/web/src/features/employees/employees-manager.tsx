"use client";

import type { EmployeeResponse } from "@haccp/shared";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  MobileHeaderAddAction,
  PageHeader,
} from "@/components/layout/page-header";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import { EmployeesData } from "@/features/employees/data-table/data";
import {
  EmployeeForm,
  type EmployeeFormValues,
} from "@/features/employees/employee-form";
import { useEmployeesMutations } from "@/features/employees/hooks/use-employees-mutations";
import { useEmployeesQuery } from "@/features/employees/hooks/use-employees-query";
import {
  hasInviteMetadataChanges,
  resolveEmployeeLocationIds,
} from "@/features/employees/utils";
import { useTenant } from "@/features/tenant/tenant-provider";
import { getErrorMessage } from "@/lib/api/get-error-message";

type EmployeesManagerProps = {
  initialItems: EmployeeResponse[];
};

export function EmployeesManager({ initialItems }: EmployeesManagerProps) {
  const t = useTranslations("EmployeesPage");
  const {
    organization,
    locations: tenantLocations,
    locationId,
  } = useTenant();
  const multipleLocationsEnabled = organization.multipleLocationsEnabled;
  const defaultLocationId =
    tenantLocations.find((location) => location.isDefault)?.id ?? locationId;
  const { data: items = [] } = useEmployeesQuery({
    initialData: initialItems,
  });
  const { create, update, updateRole, invite, revokeInvitation, remove } =
    useEmployeesMutations();

  const [formOpen, setFormOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] =
    useState<EmployeeResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeResponse | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const openCreateForm = useCallback(() => {
    setEditingEmployee(null);
    setFormOpen(true);
    setDeleteTarget(null);
  }, []);

  const openEditForm = useCallback((employee: EmployeeResponse) => {
    setEditingEmployee(employee);
    setFormOpen(true);
    setDeleteTarget(null);
  }, []);

  const handleDelete = useCallback((employee: EmployeeResponse) => {
    setIsDeleting(false);
    setDeleteTarget(employee);
  }, []);

  const handleInvite = useCallback(
    async (employee: EmployeeResponse) => {
      try {
        await invite.mutateAsync(employee.id);
        toast.success(t("toast.inviteSuccess"));
      } catch (error) {
        toast.error(getErrorMessage(error, t("errors.generic")));
      }
    },
    [invite, t],
  );

  const handleRevokeInvitation = useCallback(
    async (employee: EmployeeResponse) => {
      try {
        await revokeInvitation.mutateAsync(employee.id);
        toast.success(t("toast.revokeSuccess"));
      } catch (error) {
        toast.error(getErrorMessage(error, t("errors.generic")));
      }
    },
    [revokeInvitation, t],
  );

  const handleSave = useCallback(
    async (values: EmployeeFormValues, inviteNow: boolean): Promise<boolean> => {
      const locationIds = resolveEmployeeLocationIds(values.locationIds, {
        role: values.role,
        multipleLocationsEnabled,
        defaultLocationId,
      });

      try {
        if (editingEmployee) {
          const metadataChanged =
            editingEmployee.status === "invited" &&
            hasInviteMetadataChanges(editingEmployee, values);

          // Role is Clerk-first and lives behind its own endpoint (HACCP-56 §1) —
          // never bundled with the profile/location PATCH below.
          if (values.role !== editingEmployee.role) {
            await updateRole.mutateAsync({
              id: editingEmployee.id,
              role: values.role,
            });
          }

          await update.mutateAsync({
            id: editingEmployee.id,
            input: {
              ...(editingEmployee.status !== "active" && { email: values.email }),
              firstName: values.firstName,
              lastName: values.lastName,
              locationIds,
            },
          });

          toast.success(
            metadataChanged
              ? t("toast.updateResendSuccess")
              : t("toast.updateSuccess"),
          );
        } else {
          await create.mutateAsync({
            email: values.email,
            firstName: values.firstName,
            lastName: values.lastName,
            role: values.role,
            locationIds,
            inviteNow,
          });
          toast.success(
            inviteNow ? t("toast.createInviteSuccess") : t("toast.createSuccess"),
          );
        }

        return true;
      } catch (error) {
        toast.error(getErrorMessage(error, t("errors.generic")));
        throw error;
      }
    },
    [
      create,
      defaultLocationId,
      editingEmployee,
      multipleLocationsEnabled,
      t,
      update,
      updateRole,
    ],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);

    try {
      await remove.mutateAsync(deleteTarget.id);
      toast.success(t("toast.deleteSuccess"));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error, t("errors.generic")));
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, remove, t]);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <MobileHeaderAddAction label={t("add")} onClick={openCreateForm} />

      <PageHeader title={t("title")} description={t("description")} />

      <EmployeesData
        items={items}
        onAdd={openCreateForm}
        onEdit={openEditForm}
        onInvite={handleInvite}
        onRevokeInvitation={handleRevokeInvitation}
        onDelete={handleDelete}
      />

      <EmployeeForm
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editingEmployee}
        locations={tenantLocations}
        onSave={handleSave}
      />

      <ResponsiveAlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
        title={t("deleteDialog.title")}
        description={
          deleteTarget
            ? t("deleteDialog.confirm", { email: deleteTarget.email })
            : t("deleteDialog.fallback")
        }
        cancelLabel={t("deleteDialog.cancel")}
        cancelDisabled={isDeleting}
        confirmLabel={t("deleteDialog.confirmAction")}
        confirmIcon={<Trash2Icon data-icon="inline-start" />}
        isLoading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
