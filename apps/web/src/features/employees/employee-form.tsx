"use client";

import {
  ORG_ROLE,
  requiresLocationAssignments,
  type EmployeeResponse,
  type LocationResponse,
  needsLocationSelection,
} from "@haccp/shared";
import { useAuth } from "@clerk/nextjs";
import { zodResolver } from "@hookform/resolvers/zod";
import { useZodErrorMap } from "@/lib/forms/zod-error-map";
import { SaveIcon, SendIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useFormState, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  ResponsiveFormDialog,
  type ResponsiveFormActions,
} from "@/components/ui/responsive-form-dialog";
import { DialogFooter } from "@/components/ui/dialog";
import { ResponsiveAlertDialog } from "@/components/ui/responsive-alert-dialog";
import {
  REQUIRED_LABEL_CLASS,
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LocationMultiSelect } from "@/features/employees/location-multi-select";
import {
  hasInviteMetadataChanges,
  resolveEmployeeLocationIds,
} from "@/features/employees/utils";
import { useTenant } from "@/features/tenant/tenant-provider";
import { getErrorMessage } from "@/lib/api/get-error-message";

type EmployeeFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: EmployeeResponse | null;
  locations: LocationResponse[];
  onSave: (values: EmployeeFormValues, inviteNow: boolean) => Promise<boolean>;
};

type EmployeeRole = typeof ORG_ROLE.ADMIN | typeof ORG_ROLE.EMPLOYEE;
type SubmitAction = "save" | "invite";

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

export function EmployeeForm({
  open,
  onOpenChange,
  employee,
  locations,
  onSave,
}: EmployeeFormProps) {
  const t = useTranslations("EmployeesPage");
  const { userId: clerkUserId } = useAuth();
  const { organization, locations: tenantLocations, locationId } =
    useTenant();
  const multipleLocationsEnabled = organization.multipleLocationsEnabled;
  const defaultLocationId = useMemo(() => {
    const defaultLocation = tenantLocations.find((location) => location.isDefault);
    return defaultLocation?.id ?? locationId;
  }, [tenantLocations, locationId]);
  const isEditing = Boolean(employee);
  const isActive = employee?.status === "active";
  // Not focused for an active member: their email field is disabled, so a
  // primed keyboard would come up over something that cannot take it.
  const emailRef = useRef<HTMLInputElement | null>(null);
  const isEditingSelf =
    Boolean(employee?.user.clerkUserId) &&
    employee?.user.clerkUserId === clerkUserId;
  const isRoleLocked = isEditingSelf;
  const [pendingAction, setPendingAction] = useState<SubmitAction | null>(null);
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<EmployeeFormValues | null>(
    null,
  );
  const [isResending, setIsResending] = useState(false);

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
        email: z.string().trim().max(256).pipe(z.email({ error: t("validation.emailInvalid") })),
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
            { error: t("validation.roleRequired") },
          ),
        locationIds: z.array(z.uuid()),
      })
      .check((ctx) => {
        // Same predicate the API enforces. The form additionally waives it for
        // single-location organisations, where there is nothing to choose and
        // the assignment is filled in on submit.
        if (
          needsLocationSelection({ ...ctx.value, multipleLocationsEnabled })
        ) {
          ctx.issues.push({
            code: "custom",
            path: ["locationIds"],
            message: t("validation.locationsRequired"),
            input: ctx.value.locationIds,
          });
        }
      }),
    [multipleLocationsEnabled, t],
  );

  const resolveLocationIds = useCallback(
    (role: string, locationIds: string[] | undefined) =>
      resolveEmployeeLocationIds(locationIds ?? [], {
        role,
        multipleLocationsEnabled,
        defaultLocationId,
      }),
    [defaultLocationId, multipleLocationsEnabled],
  );

  const zodErrorMap = useZodErrorMap();

  const form = useForm<EmployeeFormInput, unknown, EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema, { error: zodErrorMap }),
    defaultValues: {
      email: employee?.email ?? "",
      firstName: employee?.firstName ?? "",
      lastName: employee?.lastName ?? "",
      role: employee?.role ?? "",
      locationIds: resolveLocationIds(employee?.role ?? "", employee?.locationIds),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        email: employee?.email ?? "",
        firstName: employee?.firstName ?? "",
        lastName: employee?.lastName ?? "",
        role: employee?.role ?? "",
        locationIds: resolveLocationIds(employee?.role ?? "", employee?.locationIds),
      });
    }
  }, [open, employee, form, resolveLocationIds]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPendingAction(null);
      setResendConfirmOpen(false);
      setPendingValues(null);
      setIsResending(false);
    }
    onOpenChange(nextOpen);
  };

  const { isDirty } = useFormState({ control: form.control });
  const hasChanges = !isEditing || !employee || isDirty;

  const selectedRole = useWatch({ control: form.control, name: "role" });
  // Admins reach every location, so there is nothing to pick for them.
  const showLocationPicker =
    multipleLocationsEnabled && requiresLocationAssignments(selectedRole);

  const submit = async (inviteNow: boolean) => {
    const action: SubmitAction = inviteNow ? "invite" : "save";
    setPendingAction(action);

    try {
      await form.handleSubmit(async (values) => {
        const completed = await onSave(
          {
            ...values,
            locationIds: resolveLocationIds(values.role, values.locationIds),
          },
          inviteNow,
        );
        if (completed) {
          onOpenChange(false);
        }
      })();
    } finally {
      setPendingAction(null);
    }
  };

  const submitEdit = async () => {
    setPendingAction("save");

    try {
      await form.handleSubmit(async (values) => {
        const resolved = {
          ...values,
          locationIds: resolveLocationIds(values.role, values.locationIds),
        };

        if (
          employee?.status === "invited" &&
          hasInviteMetadataChanges(employee, resolved)
        ) {
          setPendingValues(resolved);
          setResendConfirmOpen(true);
          return;
        }

        const completed = await onSave(resolved, false);
        if (completed) {
          onOpenChange(false);
        }
      })();
    } finally {
      setPendingAction(null);
    }
  };

  const confirmResend = async () => {
    if (!pendingValues) {
      return;
    }

    setIsResending(true);

    try {
      const completed = await onSave(pendingValues, false);
      if (completed) {
        setResendConfirmOpen(false);
        setPendingValues(null);
        onOpenChange(false);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, t("errors.generic")));
    } finally {
      setIsResending(false);
    }
  };

  const handleResendConfirmOpenChange = (nextOpen: boolean) => {
    if (isResending) {
      return;
    }

    if (nextOpen && !pendingValues) {
      return;
    }

    setResendConfirmOpen(nextOpen);

    if (!nextOpen) {
      setPendingValues(null);
    }
  };

  const formFooter = (
      <DialogFooter>
        {!isEditing ? (
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              isLoading={pendingAction === "save"}
              disabled={pendingAction !== null && pendingAction !== "save"}
              onClick={() => void submit(false)}
            >
              <SaveIcon data-icon="inline-start" />
              {t("save")}
            </Button>
            <Button
              type="button"
              isLoading={pendingAction === "invite"}
              disabled={pendingAction !== null && pendingAction !== "invite"}
              onClick={() => void submit(true)}
            >
              <SendIcon data-icon="inline-start" />
              {t("saveAndInvite")}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            isLoading={pendingAction === "save"}
            disabled={
              !hasChanges ||
              (pendingAction !== null && pendingAction !== "save")
            }
            onClick={() => void submitEdit()}
          >
            <SaveIcon data-icon="inline-start" />
            {t("save")}
          </Button>
        )}
      </DialogFooter>
  );

  // A new employee has two genuine ways to finish, neither subordinate to the
  // other, so they split the bar evenly rather than hiding one behind a menu.
  const formActions: ResponsiveFormActions = isEditing
    ? {
        items: [
          {
            label: t("save"),
            icon: <SaveIcon data-icon="inline-start" />,
            isLoading: pendingAction === "save",
            disabled:
              !hasChanges ||
              (pendingAction !== null && pendingAction !== "save"),
            onClick: () => void submitEdit(),
          },
        ],
      }
    : {
        layout: "split",
        items: [
          {
            label: t("save"),
            variant: "outline",
            isLoading: pendingAction === "save",
            disabled: pendingAction !== null && pendingAction !== "save",
            onClick: () => void submit(false),
          },
          {
            label: t("saveAndInvite"),
            isLoading: pendingAction === "invite",
            disabled: pendingAction !== null && pendingAction !== "invite",
            onClick: () => void submit(true),
          },
        ],
      };

  return (
    <>
      <ResponsiveAlertDialog
        open={resendConfirmOpen}
        onOpenChange={handleResendConfirmOpenChange}
        title={t("resendDialog.title")}
        description={t("resendDialog.confirm")}
        cancelLabel={t("resendDialog.cancel")}
        cancelDisabled={isResending}
        confirmLabel={t("resendDialog.confirmAction")}
        isLoading={isResending}
        onConfirm={() => void confirmResend()}
      />
      <ResponsiveFormDialog
      open={open}
      onOpenChange={handleDialogOpenChange}
      title={isEditing ? t("editTitle") : t("addTitle")}
      description={isEditing ? t("editDescription") : t("addDescription")}
      closeLabel={t("cancel")}
      autoFocusField={isActive ? undefined : { ref: emailRef }}
      actions={formActions}
      footer={formFooter}
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
                    ref={(node) => {
                      field.ref(node);
                      emailRef.current = node;
                    }}
                    id="employee-email"
                    type="email"
                    inputMode="email"
                    enterKeyHint="next"
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
              render={({ field, fieldState }) => {
                const roleSelect = (
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
                    disabled={isRoleLocked}
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
                );

                return (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel className={REQUIRED_LABEL_CLASS}>
                      {t("roleLabel")}
                    </FieldLabel>
                    {isRoleLocked ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <span className="block w-full">{roleSelect}</span>
                          }
                        />
                        <TooltipContent side="bottom">
                          {t("roleLockedSelf")}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      roleSelect
                    )}
                    {fieldState.error ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                );
              }}
            />

            {showLocationPicker ? (
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
                      moreSelectedLabel={(count) => t("moreSelected", { count })}
                      overflowRemoveLabel={(count) =>
                        t("overflowRemoveLabel", { count })
                      }
                    />
                    {fieldState.error ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />
            ) : null}
          </FieldGroup>

        </form>
      </ResponsiveFormDialog>
    </>
  );
}
