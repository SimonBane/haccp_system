"use client";

import type { TodayTaskItem } from "@haccp/shared";
import { classifyTemperatureResult } from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { formatTemperature } from "../lib/format";
import { parseLocalizedTemperature } from "../lib/temperature";
import { TemperatureReadingStep } from "./temperature-reading-step";

const TEMPERATURE_FORM_ID = "temperature-check-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TodayTaskItem;
  minTempC: number;
  maxTempC: number;
  onConfirm: (recordedC: number, correctiveAction?: string) => Promise<void>;
};

export function TemperatureCheckDialog({
  open,
  onOpenChange,
  task,
  minTempC,
  maxTempC,
  onConfirm,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();

  const formSchema = useMemo(
    () =>
      z
        .object({
          recordedC: z
            .string()
            .trim()
            .min(1, t("temperatureDialog.validation.required"))
            .refine(
              (value) =>
                value.length > 0 &&
                Number.isFinite(parseLocalizedTemperature(value)),
              { message: t("temperatureDialog.validation.invalid") },
            ),
          correctiveAction: z
            .string()
            .trim()
            .max(1000, t("temperatureDialog.validation.correctiveActionMax")),
        })
        .superRefine((values, context) => {
          const recordedC = parseLocalizedTemperature(values.recordedC);
          if (
            Number.isFinite(recordedC) &&
            classifyTemperatureResult({ recordedC, minTempC, maxTempC }) ===
              "out_of_range" &&
            !values.correctiveAction
          ) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["correctiveAction"],
              message: t(
                "temperatureDialog.validation.correctiveActionRequired",
              ),
            });
          }
        }),
    [maxTempC, minTempC, t],
  );

  type FormValues = z.infer<typeof formSchema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { recordedC: "", correctiveAction: "" },
    mode: "onTouched",
  });

  const recordedC = useWatch({ control: form.control, name: "recordedC" });
  const correctiveAction = useWatch({
    control: form.control,
    name: "correctiveAction",
  });
  const { errors, isSubmitting, isSubmitted } = form.formState;

  useEffect(() => {
    if (!open) {
      form.reset({ recordedC: "", correctiveAction: "" });
    }
  }, [open, form]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) return;
    onOpenChange(nextOpen);
  }

  async function handleValidSubmit(values: FormValues) {
    const parsed = parseLocalizedTemperature(values.recordedC);
    if (!Number.isFinite(parsed)) return;

    await onConfirm(parsed, values.correctiveAction || undefined);
    form.reset({ recordedC: "", correctiveAction: "" });
  }

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      mobileHeight="content"
      title={task.title}
      description={
        <>
          {task.equipmentName ? `${task.equipmentName} · ` : ""}
          {task.scheduledTime} · {t("temperatureDialog.allowedRange")}:{" "}
          {formatTemperature(minTempC, locale)} –{" "}
          {formatTemperature(maxTempC, locale)} °C
        </>
      }
      footer={
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="min-h-11 sm:min-h-9"
            disabled={isSubmitting}
            onClick={() => handleOpenChange(false)}
          >
            {t("temperatureDialog.cancel")}
          </Button>
          <Button
            type="submit"
            form={TEMPERATURE_FORM_ID}
            className="min-h-12 sm:min-h-9"
            isLoading={isSubmitting}
          >
            {t("temperatureDialog.confirm")}
          </Button>
        </DialogFooter>
      }
    >
      <form
        id={TEMPERATURE_FORM_ID}
        onSubmit={form.handleSubmit(handleValidSubmit)}
      >
        <TemperatureReadingStep
          idPrefix={TEMPERATURE_FORM_ID}
          minTempC={minTempC}
          maxTempC={maxTempC}
          value={recordedC}
          onValueChange={(next) =>
            form.setValue("recordedC", next, { shouldValidate: isSubmitted })
          }
          valueError={errors.recordedC?.message}
          correctiveAction={correctiveAction}
          onCorrectiveActionChange={(next) =>
            form.setValue("correctiveAction", next, {
              shouldValidate: isSubmitted,
            })
          }
          correctiveActionError={errors.correctiveAction?.message}
          onValueBlur={() => void form.trigger("recordedC")}
          onCorrectiveActionBlur={() => void form.trigger("correctiveAction")}
        />
      </form>
    </ResponsiveFormDialog>
  );
}
