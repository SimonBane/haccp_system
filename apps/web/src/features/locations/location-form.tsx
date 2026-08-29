"use client";

import type { LocationResponse } from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useZodErrorMap } from "@/lib/forms/zod-error-map";
import { PlusIcon, SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import { useForm, useFormState } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { FieldGroup } from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";

type LocationFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: LocationResponse | null;
  onSubmit: (values: { name: string }) => Promise<void>;
};

const LOCATION_FORM_ID = "location-form";

export function LocationForm({
  open,
  onOpenChange,
  location,
  onSubmit,
}: LocationFormProps) {
  const t = useTranslations("LocationsPage");
  const showApiError = useApiErrorToast();
  const isEditing = Boolean(location);
  const nameRef = useRef<HTMLInputElement | null>(null);

  const locationFormSchema = useMemo(
    () =>
      z.object({
        name: z
          .string()
          .trim()
          .min(1, t("validation.nameRequired"))
          .max(100, t("validation.nameMaxLength")),
      }),
    [t],
  );

  const zodErrorMap = useZodErrorMap();

  const form = useForm({
    resolver: zodResolver(locationFormSchema, { error: zodErrorMap }),
    defaultValues: {
      name: location?.name ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: location?.name ?? "",
      });
    }
  }, [open, location, form]);

  const { isSubmitting, isDirty } = useFormState({ control: form.control });
  const hasChanges = !isEditing || !location || isDirty;

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (error) {
      showApiError(error);
    }
  });

  const submitLabel = isEditing ? t("save") : t("add");
  const SubmitIcon = isEditing ? SaveIcon : PlusIcon;

  const formFooter = (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        className="max-md:hidden"
        onClick={() => onOpenChange(false)}
      >
        {t("cancel")}
      </Button>
      <Button
        type="submit"
        form={LOCATION_FORM_ID}
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
      title={isEditing ? t("editTitle") : t("addTitle")}
      description={isEditing ? t("editDescription") : t("addDescription")}
      closeLabel={t("cancel")}
      footer={formFooter}
    >
      <form id={LOCATION_FORM_ID} className="space-y-4" onSubmit={handleSubmit}>
        <FieldGroup>
          <FormField
            control={form.control}
            name="name"
            htmlFor="location-name"
            label={t("nameLabel")}
            required
          >
            {({ field, id }) => (
              <Input
                {...field}
                ref={(node) => {
                  field.ref(node);
                  nameRef.current = node;
                }}
                id={id}
                autoComplete="off"
                enterKeyHint="done"
                placeholder={t("namePlaceholder")}
              />
            )}
          </FormField>
        </FieldGroup>
      </form>
    </ResponsiveFormDialog>
  );
}
