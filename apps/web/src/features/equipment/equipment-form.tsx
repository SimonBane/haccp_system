"use client";

import {
  API_ERROR_CODE,
  EQUIPMENT_DEFAULT_TEMPS,
  EQUIPMENT_TEMP_MAX_C,
  EQUIPMENT_TEMP_MIN_C,
  equipmentTypeSchema,
  type EquipmentFieldsInput,
  type EquipmentResponse,
  type EquipmentType,
} from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useZodErrorMap } from "@/lib/forms/zod-error-map";
import { useTranslations } from "next-intl";
import { PlusIcon, SaveIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Controller, useForm, useFormState } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  REQUIRED_LABEL_CLASS,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { ApiRequestError } from "@/lib/api-utils";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EquipmentFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment?: EquipmentResponse | null;
  duplicateSource?: EquipmentResponse | null;
  suggestedDuplicateName?: string;
  existingItems?: Pick<EquipmentResponse, "id" | "name">[];
  onSubmit: (values: EquipmentFieldsInput) => Promise<void>;
};

const EQUIPMENT_TYPES: EquipmentType[] = ["fridge", "freezer", "display_case"];

const EQUIPMENT_FORM_ID = "equipment-form";

const numberInputNoSpinClass =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

/** At most 2 digits before the decimal and 1 digit after (e.g. -40, 15, 4.5). */
const TEMP_INPUT_PATTERN = /^-?\d{0,2}(?:\.\d{0,1})?$/;

function isAllowedTempInput(raw: string): boolean {
  return raw === "" || TEMP_INPUT_PATTERN.test(raw);
}

function parseTempValue(raw: string): number | null {
  if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
    return null;
  }

  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

function hasEquipmentChanges(
  values: {
    name: string;
    type: EquipmentType | "";
    minTempC: string;
    maxTempC: string;
  },
  equipment: EquipmentResponse,
): boolean {
  return (
    values.name !== equipment.name ||
    values.type !== equipment.type ||
    Number(values.minTempC) !== equipment.minTempC ||
    Number(values.maxTempC) !== equipment.maxTempC
  );
}

function buildDefaultValues(
  equipment?: EquipmentResponse | null,
  duplicateSource?: EquipmentResponse | null,
  suggestedDuplicateName?: string,
): {
  name: string;
  type: EquipmentType | "";
  minTempC: string;
  maxTempC: string;
} {
  if (equipment) {
    return {
      name: equipment.name,
      type: equipment.type,
      minTempC: String(equipment.minTempC),
      maxTempC: String(equipment.maxTempC),
    };
  }

  if (duplicateSource) {
    return {
      name: suggestedDuplicateName ?? duplicateSource.name,
      type: duplicateSource.type,
      minTempC: String(duplicateSource.minTempC),
      maxTempC: String(duplicateSource.maxTempC),
    };
  }

  return {
    name: "",
    type: "",
    minTempC: "",
    maxTempC: "",
  };
}

export function EquipmentForm({
  open,
  onOpenChange,
  equipment,
  duplicateSource,
  suggestedDuplicateName,
  existingItems = [],
  onSubmit,
}: EquipmentFormProps) {
  const t = useTranslations("EquipmentPage");
  const showApiError = useApiErrorToast();
  const isEditing = Boolean(equipment);
  const isDuplicating = Boolean(duplicateSource) && !isEditing;
  const nameRef = useRef<HTMLInputElement | null>(null);

  const equipmentFormSchema = useMemo(() => {
    const tempSchema = z.string().superRefine((value, ctx) => {
      const parsed = parseTempValue(value);
      if (parsed === null) {
        ctx.addIssue({
          code: "custom",
          message: t("validation.tempRequired"),
        });
        return;
      }

      if (parsed < EQUIPMENT_TEMP_MIN_C) {
        ctx.addIssue({
          code: "custom",
          message: t("validation.minTemp"),
        });
        return;
      }

      if (parsed > EQUIPMENT_TEMP_MAX_C) {
        ctx.addIssue({
          code: "custom",
          message: t("validation.maxTemp"),
        });
      }
    });

    return z
      .object({
        name: z
          .string()
          .trim()
          .min(1, t("validation.nameRequired"))
          .max(100, t("validation.nameMaxLength")),
        type: z
          .union([equipmentTypeSchema, z.literal("")])
          .refine((value): value is EquipmentType => value !== "", {
            error: t("validation.typeRequired"),
          }),
        minTempC: tempSchema,
        maxTempC: tempSchema,
      })
      .superRefine((data, ctx) => {
        const minTempC = parseTempValue(data.minTempC);
        const maxTempC = parseTempValue(data.maxTempC);
        if (minTempC !== null && maxTempC !== null && minTempC >= maxTempC) {
          ctx.addIssue({
            code: "custom",
            message: t("validation.tempRange"),
            path: ["minTempC"],
          });
        }
      });
  }, [t]);

  type EquipmentFormValues = {
    name: string;
    type: EquipmentType | "";
    minTempC: string;
    maxTempC: string;
  };

  const defaultValues = useMemo(
    () =>
      buildDefaultValues(equipment, duplicateSource, suggestedDuplicateName),
    [equipment, duplicateSource, suggestedDuplicateName],
  );

  const zodErrorMap = useZodErrorMap();

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema, { error: zodErrorMap }),
    defaultValues,
    mode: "onTouched",
  });

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues);
  }, [open, defaultValues, form]);

  const typeLabels: Record<EquipmentType, string> = {
    fridge: t("types.fridge"),
    freezer: t("types.freezer"),
    display_case: t("types.displayCase"),
  };

  const typeItems = EQUIPMENT_TYPES.map((equipmentType) => ({
    label: typeLabels[equipmentType],
    value: equipmentType,
  }));

  async function handleValidSubmit(values: EquipmentFormValues) {
    const minTempC = parseTempValue(values.minTempC);
    const maxTempC = parseTempValue(values.maxTempC);
    if (!values.type || minTempC === null || maxTempC === null) {
      return;
    }

    if (isEditing && equipment && !hasEquipmentChanges(values, equipment)) {
      onOpenChange(false);
      return;
    }

    const payload = {
      name: values.name,
      type: values.type,
      minTempC,
      maxTempC,
    };

    const isNameTaken = existingItems.some(
      (item) => item.name === values.name && item.id !== equipment?.id,
    );

    if (isNameTaken) {
      form.setError("name", { message: t("nameTaken") });
      return;
    }

    try {
      await onSubmit(payload);
      onOpenChange(false);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === API_ERROR_CODE.EQUIPMENT_NAME_EXISTS
      ) {
        form.setError("name", { message: t("nameTaken") });
        return;
      }

      showApiError(error);
    }
  }

  const { isSubmitting, errors } = useFormState({
    control: form.control,
    name: ["minTempC", "maxTempC"],
  });

  const { isDirty } = useFormState({
    control: form.control,
  });

  const hasChanges = !isEditing || !equipment || isDirty;

  const submitLabel = isEditing ? t("save") : t("add");
  const SubmitIcon = isEditing ? SaveIcon : PlusIcon;

  const formFooter = (
    <DialogFooter>
      <Button
        type="submit"
        form={EQUIPMENT_FORM_ID}
        isLoading={isSubmitting}
        disabled={isEditing && !hasChanges}
      >
        <SubmitIcon data-icon="inline-start" />
        {submitLabel}
      </Button>
    </DialogFooter>
  );

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEditing
          ? t("editTitle")
          : isDuplicating
            ? t("duplicateTitle")
            : t("addTitle")
      }
      description={
        isEditing
          ? t("editDescription")
          : isDuplicating
            ? t("duplicateDescription")
            : t("addDescription")
      }
      className="sm:min-h-[24rem]"
      closeLabel={t("cancel")}
      initialFocus={isEditing || isDuplicating ? undefined : false}
      footer={formFooter}
    >
      <form
        id={EQUIPMENT_FORM_ID}
        onSubmit={form.handleSubmit(handleValidSubmit)}
        className="grid gap-8"
      >
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel
                  htmlFor={`${EQUIPMENT_FORM_ID}-name`}
                  className={REQUIRED_LABEL_CLASS}
                >
                  {t("nameLabel")}
                </FieldLabel>
                <Input
                  {...field}
                  ref={(node) => {
                    field.ref(node);
                    nameRef.current = node;
                  }}
                  id={`${EQUIPMENT_FORM_ID}-name`}
                  aria-invalid={fieldState.invalid}
                  placeholder={t("namePlaceholder")}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="type"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel
                  htmlFor={`${EQUIPMENT_FORM_ID}-type`}
                  className={REQUIRED_LABEL_CLASS}
                >
                  {t("typeLabel")}
                </FieldLabel>
                <Select
                  name={field.name}
                  items={typeItems}
                  value={field.value || null}
                  onValueChange={(value: unknown) => {
                    const nextType = value as EquipmentType;
                    field.onChange(nextType);

                    if (!isEditing) {
                      form.setValue(
                        "minTempC",
                        String(EQUIPMENT_DEFAULT_TEMPS[nextType].minTempC),
                      );
                      form.setValue(
                        "maxTempC",
                        String(EQUIPMENT_DEFAULT_TEMPS[nextType].maxTempC),
                      );
                    }
                  }}
                  onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                      field.onBlur();
                    }
                  }}
                >
                  <SelectTrigger
                    id={`${EQUIPMENT_FORM_ID}-type`}
                    aria-invalid={fieldState.invalid}
                    className="w-full"
                  >
                    <SelectValue placeholder={t("typePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {EQUIPMENT_TYPES.map((equipmentType) => (
                        <SelectItem key={equipmentType} value={equipmentType}>
                          {typeLabels[equipmentType]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>

        <FieldSet
          className="gap-2"
          data-invalid={Boolean(errors.minTempC || errors.maxTempC)}
        >
          <FieldLegend variant="label" className={REQUIRED_LABEL_CLASS}>
            {t("allowedTempLabel")}
          </FieldLegend>
          <div className="flex items-center gap-2">
            <Controller
              name="minTempC"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="flex-1" data-invalid={fieldState.invalid}>
                  <InputGroup>
                    <InputGroupInput
                      id={`${EQUIPMENT_FORM_ID}-min-temp`}
                      type="text"
                      inputMode="decimal"

                      enterKeyHint="next"
                      aria-invalid={fieldState.invalid}
                      className={numberInputNoSpinClass}
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (!isAllowedTempInput(next)) return;

                        field.onChange(next);
                        if (
                          form.formState.touchedFields.minTempC ||
                          form.formState.touchedFields.maxTempC
                        ) {
                          void form.trigger(["minTempC", "maxTempC"]);
                        }
                      }}
                      onBlur={() => {
                        field.onBlur();
                        void form.trigger(["minTempC", "maxTempC"]);
                      }}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>°C</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              )}
            />

            <span className="shrink-0 text-sm text-muted-foreground">
              {t("tempTo")}
            </span>

            <Controller
              name="maxTempC"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field className="flex-1" data-invalid={fieldState.invalid}>
                  <InputGroup>
                    <InputGroupInput
                      id={`${EQUIPMENT_FORM_ID}-max-temp`}
                      type="text"
                      inputMode="decimal"

                      enterKeyHint="next"
                      aria-invalid={fieldState.invalid}
                      className={numberInputNoSpinClass}
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onChange={(event) => {
                        const next = event.target.value;
                        if (!isAllowedTempInput(next)) return;

                        field.onChange(next);
                        if (
                          form.formState.touchedFields.minTempC ||
                          form.formState.touchedFields.maxTempC
                        ) {
                          void form.trigger(["minTempC", "maxTempC"]);
                        }
                      }}
                      onBlur={() => {
                        field.onBlur();
                        void form.trigger(["minTempC", "maxTempC"]);
                      }}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>°C</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
              )}
            />
          </div>
          {errors.minTempC?.message ? (
            <FieldError>{errors.minTempC.message}</FieldError>
          ) : errors.maxTempC?.message ? (
            <FieldError>{errors.maxTempC.message}</FieldError>
          ) : null}
        </FieldSet>
      </form>
    </ResponsiveFormDialog>
  );
}
