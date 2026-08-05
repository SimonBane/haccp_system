"use client";

import type { EmployeeResponse } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
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
import { MobileHeaderAddButton } from "@/components/layout/mobile-header-add-button";
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
  const { create, update, invite, revokeInvitation, remove } =
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
        multipleLocationsEnabled,
        defaultLocationId,
      });

      try {
        if (editingEmployee) {
          const metadataChanged =
            editingEmployee.status === "invited" &&
            hasInviteMetadataChanges(editingEmployee, values);

          await update.mutateAsync({
            id: editingEmployee.id,
            input: {
              ...(editingEmployee.status !== "active" && { email: values.email }),
              firstName: values.firstName,
              lastName: values.lastName,
              role: values.role,
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
    <div className="space-y-6">
      <MobileHeaderAddButton label={t("add")} onClick={openCreateForm} />

      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

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

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t("deleteDialog.confirm", { email: deleteTarget.email })
                : t("deleteDialog.fallback")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t("deleteDialog.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {t("deleteDialog.confirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
