"use client";

import {
  EQUIPMENT_DEFAULT_TEMPS,
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
import { useForm } from "react-hook-form";
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

function hasEquipmentChanges(
  values: {
    name: string;
    type: EquipmentType;
    minTempC: number;
    maxTempC: number;
  },
  equipment: EquipmentResponse,
): boolean {
  return (
    values.name !== equipment.name ||
    values.type !== equipment.type ||
    values.minTempC !== equipment.minTempC ||
    values.maxTempC !== equipment.maxTempC
  );
}

function buildDefaultValues(
  equipment?: EquipmentResponse | null,
  duplicateSource?: EquipmentResponse | null,
  suggestedDuplicateName?: string,
) {
  if (equipment) {
    return {
      name: equipment.name,
      type: equipment.type,
      minTempC: equipment.minTempC,
      maxTempC: equipment.maxTempC,
    };
  }

  if (duplicateSource) {
    return {
      name: suggestedDuplicateName ?? `${duplicateSource.name} (Copy)`,
      type: duplicateSource.type,
      minTempC: duplicateSource.minTempC,
      maxTempC: duplicateSource.maxTempC,
    };
  }

  return {
    name: "",
    type: "fridge" as EquipmentType,
    minTempC: EQUIPMENT_DEFAULT_TEMPS.fridge.minTempC,
    maxTempC: EQUIPMENT_DEFAULT_TEMPS.fridge.maxTempC,
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
    const tempSchema = z.coerce
      .number()
      .min(-40, t("validation.minTemp"))
      .max(15, t("validation.maxTemp"));

    return z
      .object({
        name: z
          .string()
          .trim()
          .min(1, t("validation.nameRequired"))
          .max(100, t("validation.nameMaxLength")),
        type: equipmentTypeSchema,
        minTempC: tempSchema,
        maxTempC: tempSchema,
      })
      .superRefine((data, ctx) => {
        if (data.minTempC >= data.maxTempC) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("validation.tempRange"),
            path: ["minTempC"],
          });
        }
      });
  }, [t]);

  type EquipmentFormValues = z.infer<typeof equipmentFormSchema>;

  const defaultValues = useMemo(
    () =>
      buildDefaultValues(equipment, duplicateSource, suggestedDuplicateName),
    [equipment, duplicateSource, suggestedDuplicateName],
  );

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues,
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
    if (isEditing && equipment && !hasEquipmentChanges(values, equipment)) {
      onOpenChange(false);
      return;
    }

    const isNameTaken = existingItems.some(
      (item) => item.name === values.name && item.id !== equipment?.id,
    );

    if (isNameTaken) {
      form.setError("name", { message: t("nameTaken") });
      return;
    }

    try {
      await onSubmit(values);
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

  const { isSubmitting } = form.formState;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-xl">
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
            className="grid gap-6"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("nameLabel")}</FormLabel>
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
                  <FormLabel>{t("typeLabel")}</FormLabel>
                  <Select
                    items={typeItems}
                    value={field.value}
                    onValueChange={(value: unknown) => {
                      const nextType = value as EquipmentType;
                      field.onChange(nextType);

                      if (!isEditing) {
                        form.setValue(
                          "minTempC",
                          EQUIPMENT_DEFAULT_TEMPS[nextType].minTempC,
                        );
                        form.setValue(
                          "maxTempC",
                          EQUIPMENT_DEFAULT_TEMPS[nextType].maxTempC,
                        );
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="minTempC"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("minTempLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        className={numberInputNoSpinClass}
                        {...field}
                        onChange={(event) => {
                          const next = event.target.value;
                          field.onChange(
                            next === "" ? "" : Number(next),
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="maxTempC"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("maxTempLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        className={numberInputNoSpinClass}
                        {...field}
                        onChange={(event) => {
                          const next = event.target.value;
                          field.onChange(
                            next === "" ? "" : Number(next),
                          );
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
