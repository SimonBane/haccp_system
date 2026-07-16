"use client";

import {
  EQUIPMENT_DEFAULT_TEMPS,
  EQUIPMENT_TEMP_MAX_C,
  EQUIPMENT_TEMP_MIN_C,
  equipmentTypeSchema,
  type EquipmentFieldsInput,
  type EquipmentResponse,
  type EquipmentType,
  type UpdateEquipmentInput,
} from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { CopyPlusIcon, PlusIcon, SaveIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useForm, useFormState } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { ApiRequestError } from "@/lib/api-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  onDuplicate?: () => void;
  onSubmit: (
    values: EquipmentFieldsInput | UpdateEquipmentInput,
  ) => Promise<void>;
};

const EQUIPMENT_TYPES: EquipmentType[] = [
  "fridge",
  "freezer",
  "display_case",
];

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
  onDuplicate,
  onSubmit,
}: EquipmentFormProps) {
  const t = useTranslations("EquipmentPage");
  const isEditing = Boolean(equipment);
  const isDuplicating = Boolean(duplicateSource) && !isEditing;

  const equipmentFormSchema = useMemo(() => {
    const tempSchema = z.string().superRefine((value, ctx) => {
      const parsed = parseTempValue(value);
      if (parsed === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.tempRequired"),
        });
        return;
      }

      if (parsed < EQUIPMENT_TEMP_MIN_C) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.minTemp"),
        });
        return;
      }

      if (parsed > EQUIPMENT_TEMP_MAX_C) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
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
            message: t("validation.typeRequired"),
          }),
        minTempC: tempSchema,
        maxTempC: tempSchema,
      })
      .superRefine((data, ctx) => {
        const minTempC = parseTempValue(data.minTempC);
        const maxTempC = parseTempValue(data.maxTempC);
        if (
          minTempC !== null &&
          maxTempC !== null &&
          minTempC >= maxTempC
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
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

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues,
    mode: "onTouched",
  });

  useEffect(() => {
    if (!open || !duplicateSource || equipment) return;

    const timeoutId = window.setTimeout(() => {
      form.setFocus("name", { shouldSelect: true });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [open, equipment, duplicateSource, suggestedDuplicateName, form]);

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
      if (error instanceof ApiRequestError && error.code === "CONFLICT") {
        form.setError("name", { message: t("nameTaken") });
        return;
      }

      toast.error(
        error instanceof Error ? error.message : t("submitError"),
      );
    }
  }

  const { isSubmitting, errors } = useFormState({
    control: form.control,
    name: ["minTempC", "maxTempC"],
  });

  const watchedValues = form.watch();
  const hasChanges =
    !isEditing ||
    !equipment ||
    hasEquipmentChanges(watchedValues, equipment);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full py-8 sm:max-w-md sm:min-h-[24rem]"
        initialFocus={isEditing || isDuplicating ? undefined : false}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t("editTitle")
              : isDuplicating
                ? t("duplicateTitle")
                : t("addTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t("editDescription")
              : isDuplicating
                ? t("duplicateDescription")
                : t("addDescription")}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleValidSubmit)}
            className="grid gap-8"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t("nameLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("namePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>{t("typeLabel")}</FormLabel>
                  <Select
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
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("typePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {EQUIPMENT_TYPES.map((equipmentType) => (
                          <SelectItem
                            key={equipmentType}
                            value={equipmentType}
                          >
                            {typeLabels[equipmentType]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label className="gap-1 after:text-destructive after:content-['*']">
                {t("allowedTempLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <FormField
                  control={form.control}
                  name="minTempC"
                  render={({ field, fieldState }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <InputGroup>
                          <InputGroupInput
                            type="text"
                            inputMode="decimal"
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
                      </FormControl>
                    </FormItem>
                  )}
                />

                <span className="shrink-0 text-sm text-muted-foreground">
                  {t("tempTo")}
                </span>

                <FormField
                  control={form.control}
                  name="maxTempC"
                  render={({ field, fieldState }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <InputGroup>
                          <InputGroupInput
                            type="text"
                            inputMode="decimal"
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
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              {errors.minTempC?.message ? (
                <p className="text-sm text-destructive">
                  {errors.minTempC.message}
                </p>
              ) : errors.maxTempC?.message ? (
                <p className="text-sm text-destructive">
                  {errors.maxTempC.message}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              {isEditing ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting}
                    onClick={onDuplicate}
                  >
                    <CopyPlusIcon data-icon="inline-start" />
                    {t("duplicate")}
                  </Button>
                  <Button
                    type="submit"
                    isLoading={isSubmitting}
                    disabled={!hasChanges}
                  >
                    <SaveIcon data-icon="inline-start" />
                    {t("save")}
                  </Button>
                </>
              ) : (
                <Button type="submit" isLoading={isSubmitting}>
                  <PlusIcon data-icon="inline-start" />
                  {t("add")}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
