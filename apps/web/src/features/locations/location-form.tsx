"use client";

import type { LocationResponse } from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, SaveIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useFormState } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type LocationFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location?: LocationResponse | null;
  onSubmit: (values: { name: string }) => Promise<void>;
};

const LOCATION_FORM_ID = "location-form";

const REQUIRED_LABEL_CLASS =
  "gap-1 after:text-destructive after:content-['*']";

export function LocationForm({
  open,
  onOpenChange,
  location,
  onSubmit,
}: LocationFormProps) {
  const t = useTranslations("LocationsPage");
  const isEditing = Boolean(location);

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

  const form = useForm<z.infer<typeof locationFormSchema>>({
    resolver: zodResolver(locationFormSchema),
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
    await onSubmit(values);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editTitle") : t("addTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t("editDescription") : t("addDescription")}
          </DialogDescription>
        </DialogHeader>

        <form id={LOCATION_FORM_ID} className="space-y-4" onSubmit={handleSubmit}>
          <FieldGroup>
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="location-name" className={REQUIRED_LABEL_CLASS}>
                    {t("nameLabel")}
                  </FieldLabel>
                  <Input
                    {...field}
                    id="location-name"
                    autoComplete="off"
                    placeholder={t("namePlaceholder")}
                  />
                  {fieldState.error ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
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
            {isEditing ? (
              <>
                <SaveIcon data-icon="inline-start" />
                {t("save")}
              </>
            ) : (
              <>
                <PlusIcon data-icon="inline-start" />
                {t("add")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
