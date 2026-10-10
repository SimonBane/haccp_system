"use client";

import {
  API_ERROR_CODE,
  type TargetInput,
  type TargetResponse,
  type TargetTypeResponse,
} from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, SaveIcon, Settings2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useFormState } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  REQUIRED_LABEL_CLASS,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiRequestError } from "@/lib/api-utils";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";
import { useZodErrorMap } from "@/lib/forms/zod-error-map";

const TARGETS_FORM_ID = "targets-form";

type TargetsFormValues = { name: string; targetTypeId: string };

type TargetsFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target?: TargetResponse | null;
  duplicateSource?: TargetResponse | null;
  suggestedDuplicateName?: string;
  targetTypes: TargetTypeResponse[];
  existingItems: Pick<TargetResponse, "id" | "name">[];
  onManageTypes: () => void;
  onSubmit: (values: TargetInput) => Promise<void>;
};

export function TargetsForm({
  open,
  onOpenChange,
  target,
  duplicateSource,
  suggestedDuplicateName,
  targetTypes,
  existingItems,
  onManageTypes,
  onSubmit,
}: TargetsFormProps) {
  const t = useTranslations("TargetsPage");
  const showApiError = useApiErrorToast();
  const isEditing = Boolean(target);
  const isDuplicating = Boolean(duplicateSource) && !isEditing;

  const schema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("validation.nameRequired"))
          .max(100, t("validation.nameMaxLength")),
        targetTypeId: z.string().min(1, t("validation.typeRequired")),
      }),
    [t],
  );

  const defaultValues = useMemo<TargetsFormValues>(() => {
    if (target) {
      return { name: target.name, targetTypeId: target.targetTypeId };
    }
    if (duplicateSource) {
      return {
        name: suggestedDuplicateName ?? duplicateSource.name,
        targetTypeId: duplicateSource.targetTypeId,
      };
    }
    return { name: "", targetTypeId: "" };
  }, [target, duplicateSource, suggestedDuplicateName]);

  const zodErrorMap = useZodErrorMap();

  const form = useForm<TargetsFormValues>({
    resolver: zodResolver(schema, { error: zodErrorMap }),
    defaultValues,
    mode: "onTouched",
  });

  useEffect(() => {
    if (!open) return;
    form.reset(defaultValues);
  }, [open, defaultValues, form]);

  const { isSubmitting, isDirty } = useFormState({ control: form.control });

  async function handleValidSubmit(values: TargetsFormValues) {
    if (isEditing && !isDirty) {
      onOpenChange(false);
      return;
    }

    const isNameTaken = existingItems.some(
      (item) => item.name === values.name.trim() && item.id !== target?.id,
    );
    if (isNameTaken) {
      form.setError("name", { message: t("nameTaken") });
      return;
    }

    try {
      await onSubmit({
        name: values.name.trim(),
        targetTypeId: values.targetTypeId,
        // Nesting has no UI yet; keep whatever parent the target already has.
        parentId: target?.parentId ?? duplicateSource?.parentId ?? null,
      });
      onOpenChange(false);
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === API_ERROR_CODE.TARGET_NAME_EXISTS
      ) {
        form.setError("name", { message: t("nameTaken") });
        return;
      }
      showApiError(error);
    }
  }

  const SubmitIcon = isEditing ? SaveIcon : PlusIcon;

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
      closeLabel={t("cancel")}
      initialFocus={isEditing || isDuplicating ? undefined : false}
      footer={
        <DialogFooter>
          <Button
            type="submit"
            form={TARGETS_FORM_ID}
            isLoading={isSubmitting}
            disabled={isEditing && !isDirty}
          >
            <SubmitIcon data-icon="inline-start" />
            {isEditing ? t("save") : t("add")}
          </Button>
        </DialogFooter>
      }
    >
      <form
        id={TARGETS_FORM_ID}
        onSubmit={form.handleSubmit(handleValidSubmit)}
      >
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel
                  htmlFor={`${TARGETS_FORM_ID}-name`}
                  className={REQUIRED_LABEL_CLASS}
                >
                  {t("nameLabel")}
                </FieldLabel>
                <Input
                  {...field}
                  id={`${TARGETS_FORM_ID}-name`}
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
            name="targetTypeId"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel
                  htmlFor={`${TARGETS_FORM_ID}-type`}
                  className={REQUIRED_LABEL_CLASS}
                >
                  {t("typeLabel")}
                </FieldLabel>
                <Select
                  name={field.name}
                  items={targetTypes.map((type) => ({
                    label: type.name,
                    value: type.id,
                  }))}
                  value={field.value || null}
                  onValueChange={(value: unknown) =>
                    field.onChange(typeof value === "string" ? value : "")
                  }
                  onOpenChange={(nextOpen) => {
                    if (!nextOpen) field.onBlur();
                  }}
                >
                  <SelectTrigger
                    id={`${TARGETS_FORM_ID}-type`}
                    aria-invalid={fieldState.invalid}
                    className="w-full"
                  >
                    <SelectValue placeholder={t("typePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectGroup>
                      {targetTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {targetTypes.length === 0 ? (
                  <FieldDescription>{t("noTypesHint")}</FieldDescription>
                ) : null}
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto w-fit p-0"
                  onClick={onManageTypes}
                >
                  <Settings2Icon data-icon="inline-start" />
                  {t("manageTypes")}
                </Button>
              </Field>
            )}
          />
        </FieldGroup>
      </form>
    </ResponsiveFormDialog>
  );
}
