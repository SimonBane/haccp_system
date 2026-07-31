"use client";

import { ORG_ROLE, type EmployeeResponse, type LocationResponse } from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { SaveIcon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo } from "react";
import { Controller, useForm, useFormState } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LocationMultiSelect } from "@/features/employees/location-multi-select";
import { useTenant } from "@/features/tenant/tenant-provider";

type EmployeeFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: EmployeeResponse | null;
  locations: LocationResponse[];
  onSave: (values: EmployeeFormValues, inviteNow: boolean) => Promise<void>;
};

type EmployeeRole = typeof ORG_ROLE.ADMIN | typeof ORG_ROLE.EMPLOYEE;

export type EmployeeFormInput = {
  email: string;
  firstName: string;
  lastName: string;
  role: EmployeeRole | "";
  locationIds: string[];
};

export type EmployeeFormValues = {
  email: string;
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  locationIds: string[];
};

const EMPLOYEE_FORM_ID = "employee-form";

const REQUIRED_LABEL_CLASS =
  "gap-1 after:text-destructive after:content-['*']";

export function EmployeeForm({
  open,
  onOpenChange,
  employee,
  locations,
  onSave,
}: EmployeeFormProps) {
  const t = useTranslations("EmployeesPage");
  const { organization, locations: tenantLocations, locationId } =
    useTenant();
  const multipleLocationsEnabled = organization.multipleLocationsEnabled;
  const defaultLocationId = useMemo(() => {
    const defaultLocation = tenantLocations.find((location) => location.isDefault);
    return defaultLocation?.id ?? locationId;
  }, [tenantLocations, locationId]);
  const isEditing = Boolean(employee);
  const isActive = employee?.status === "active";

  const roleItems = useMemo(
    () => [
      { label: t("roles.member"), value: ORG_ROLE.EMPLOYEE },
      { label: t("roles.admin"), value: ORG_ROLE.ADMIN },
    ],
    [t],
  );

  const employeeFormSchema = useMemo(
    () =>
      z.object({
        email: z.string().trim().email(t("validation.emailInvalid")).max(256),
        firstName: z
          .string()
          .trim()
          .min(1, t("validation.firstNameRequired"))
          .max(100),
        lastName: z
          .string()
          .trim()
          .min(1, t("validation.lastNameRequired"))
          .max(100),
        role: z
          .enum(["", ORG_ROLE.ADMIN, ORG_ROLE.EMPLOYEE] as const)
          .refine(
            (value): value is EmployeeRole => value !== "",
            { message: t("validation.roleRequired") },
          ),
        locationIds: multipleLocationsEnabled
          ? z
              .array(z.string().uuid())
              .min(1, t("validation.locationsRequired"))
          : z.array(z.string().uuid()),
      }),
    [multipleLocationsEnabled, t],
  );

  const resolveLocationIds = useCallback(
    (locationIds: string[] | undefined) => {
      if (multipleLocationsEnabled) {
        return locationIds ?? [];
      }

      return locationIds && locationIds.length > 0
        ? locationIds
        : [defaultLocationId];
    },
    [defaultLocationId, multipleLocationsEnabled],
  );

  const form = useForm<EmployeeFormInput, unknown, EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      email: employee?.email ?? "",
      firstName: employee?.firstName ?? "",
      lastName: employee?.lastName ?? "",
      role: employee?.role ?? "",
      locationIds: resolveLocationIds(employee?.locationIds),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        email: employee?.email ?? "",
        firstName: employee?.firstName ?? "",
        lastName: employee?.lastName ?? "",
        role: employee?.role ?? "",
        locationIds: resolveLocationIds(employee?.locationIds),
      });
    }
  }, [open, employee, form, resolveLocationIds]);

  const { isSubmitting, isDirty } = useFormState({ control: form.control });
  const hasChanges = !isEditing || !employee || isDirty;

  const submit = async (inviteNow: boolean) => {
    await form.handleSubmit(async (values) => {
      await onSave(
        {
          ...values,
          locationIds: resolveLocationIds(values.locationIds),
        },
        inviteNow,
      );
      onOpenChange(false);
    })();
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? t("editTitle") : t("addTitle")}
      description={isEditing ? t("editDescription") : t("addDescription")}
    >
        <form id={EMPLOYEE_FORM_ID} className="space-y-6">
          <FieldGroup>
            <Controller
              control={form.control}
              name="email"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="employee-email" className={REQUIRED_LABEL_CLASS}>
                    {t("emailLabel")}
                  </FieldLabel>
                  <Input
                    {...field}
                    id="employee-email"
                    type="email"
                    autoComplete="off"
                    disabled={isActive}
                    placeholder={t("emailPlaceholder")}
                  />
                  {fieldState.error ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="firstName"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel
                      htmlFor="employee-first-name"
                      className={REQUIRED_LABEL_CLASS}
                    >
                      {t("firstNameLabel")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="employee-first-name"
                      autoComplete="off"
                      disabled={isActive}
                      placeholder={t("firstNamePlaceholder")}
                    />
                    {fieldState.error ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="lastName"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel
                      htmlFor="employee-last-name"
                      className={REQUIRED_LABEL_CLASS}
                    >
                      {t("lastNameLabel")}
                    </FieldLabel>
                    <Input
                      {...field}
                      id="employee-last-name"
                      autoComplete="off"
                      disabled={isActive}
                      placeholder={t("lastNamePlaceholder")}
                    />
                    {fieldState.error ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />
            </div>

            <Controller
              control={form.control}
              name="role"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel className={REQUIRED_LABEL_CLASS}>
                    {t("roleLabel")}
                  </FieldLabel>
                  <Select
                    name={field.name}
                    items={roleItems}
                    value={field.value || null}
                    onValueChange={(value) =>
                      field.onChange(value as EmployeeFormInput["role"])
                    }
                    onOpenChange={(nextOpen) => {
                      if (!nextOpen) {
                        field.onBlur();
                      }
                    }}
                    disabled={isActive}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("rolePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectItem value={ORG_ROLE.EMPLOYEE}>
                        {t("roles.member")}
                      </SelectItem>
                      <SelectItem value={ORG_ROLE.ADMIN}>
                        {t("roles.admin")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldState.error ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />

            {multipleLocationsEnabled ? (
              <Controller
                control={form.control}
                name="locationIds"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel
                      htmlFor="employee-locations"
                      className={REQUIRED_LABEL_CLASS}
                    >
                      {t("locationsLabel")}
                    </FieldLabel>
                    <FieldDescription>{t("locationsDescription")}</FieldDescription>
                    <LocationMultiSelect
                      id="employee-locations"
                      locations={locations}
                      value={field.value}
                      onValueChange={field.onChange}
                      invalid={fieldState.invalid}
                      placeholder={t("locationsPlaceholder")}
                      emptyMessage={t("locationsEmpty")}
                      noLocationsMessage={t("noLocationsAvailable")}
                    />
                    {fieldState.error ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />
            ) : null}
          </FieldGroup>

          <DialogFooter>
            {!isEditing ? (
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  isLoading={isSubmitting}
                  onClick={() => void submit(false)}
                >
                  <SaveIcon data-icon="inline-start" />
                  {t("save")}
                </Button>
                <Button
                  type="button"
                  isLoading={isSubmitting}
                  onClick={() => void submit(true)}
                >
                  <SendIcon data-icon="inline-start" />
                  {t("saveAndInvite")}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                isLoading={isSubmitting}
                disabled={!hasChanges}
                onClick={() => void submit(false)}
              >
                <SaveIcon data-icon="inline-start" />
                {t("save")}
              </Button>
            )}
          </DialogFooter>
        </form>
    </ResponsiveFormDialog>
  );
}
