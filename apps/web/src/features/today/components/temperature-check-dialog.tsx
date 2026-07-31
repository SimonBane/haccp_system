"use client";

import type { TodayTaskItem } from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { Textarea } from "@/components/ui/textarea";

const TEMPERATURE_FORM_ID = "temperature-check-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TodayTaskItem;
  minTempC: number;
  maxTempC: number;
  onConfirm: (recordedC: number, correctiveAction?: string) => Promise<void>;
};

function parseLocalizedTemperature(value: string): number {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  return normalized.length > 0 ? Number(normalized) : Number.NaN;
}

function classify(
  recordedC: number,
  min: number,
  max: number,
): "ok" | "out_of_range" {
  return recordedC >= min && recordedC <= max ? "ok" : "out_of_range";
}

export function TemperatureCheckDialog({
  open,
  onOpenChange,
  task,
  minTempC,
  maxTempC,
  onConfirm,
}: Props) {
  const t = useTranslations("TodayPage");

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
              {
                message: t("temperatureDialog.validation.invalid"),
              },
            ),
          correctiveAction: z
            .string()
            .trim()
            .max(1000, t("temperatureDialog.validation.correctiveActionMax")),
        })
        .superRefine((values, context) => {
          const value = parseLocalizedTemperature(values.recordedC);
          if (
            Number.isFinite(value) &&
            classify(value, minTempC, maxTempC) === "out_of_range" &&
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

  const recordedCText = useWatch({
    control: form.control,
    name: "recordedC",
  });

  const recordedC = useMemo(() => {
    const value = parseLocalizedTemperature(recordedCText);
    return Number.isFinite(value) ? value : Number.NaN;
  }, [recordedCText]);

  const result = useMemo(() => {
    if (!Number.isFinite(recordedC)) return null;
    return classify(recordedC, minTempC, maxTempC);
  }, [recordedC, minTempC, maxTempC]);

  const rangeLabel = `${minTempC}°C – ${maxTempC}°C`;

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

  const { isSubmitting } = form.formState;

  const description = (
    <>
      {task.equipmentName ? `${task.equipmentName} · ` : ""}
      {task.scheduledTime} · {t("temperatureDialog.allowedRange")}: {rangeLabel}
    </>
  );

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={task.title}
      description={description}
      footer={
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 sm:min-h-9"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            {t("temperatureDialog.cancel")}
          </Button>
          <Button
            type="submit"
            form={TEMPERATURE_FORM_ID}
            className="min-h-11 sm:min-h-9"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {t("temperatureDialog.confirm")}
          </Button>
        </DialogFooter>
      }
    >
      <form
        id={TEMPERATURE_FORM_ID}
        onSubmit={form.handleSubmit(handleValidSubmit)}
        className="space-y-3"
      >
        <Controller
          name="recordedC"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${TEMPERATURE_FORM_ID}-recorded-c`}>
                {t("temperatureDialog.recordedCLabel")} (
                {t("temperatureDialog.celsius")})
              </FieldLabel>
              <Input
                {...field}
                id={`${TEMPERATURE_FORM_ID}-recorded-c`}
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                aria-invalid={fieldState.invalid}
                aria-describedby={result ? "temperature-result" : undefined}
                className="h-12 text-center text-2xl font-semibold tabular-nums"
                placeholder={t("temperatureDialog.recordedCPlaceholder")}
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />

        {result && (
          <div
            id="temperature-result"
            className="flex flex-wrap items-center gap-2"
          >
            <Badge variant={result === "ok" ? "secondary" : "destructive"}>
              {result === "ok"
                ? t("temperatureDialog.ok")
                : t("temperatureDialog.outOfRange")}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {result === "ok"
                ? t("temperatureDialog.okHint")
                : t("temperatureDialog.outOfRangeHint")}
            </span>
          </div>
        )}

        {result === "out_of_range" && (
          <Controller
            name="correctiveAction"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel
                  htmlFor={`${TEMPERATURE_FORM_ID}-corrective-action`}
                >
                  {t("temperatureDialog.correctiveActionLabel")}
                </FieldLabel>
                <Textarea
                  {...field}
                  id={`${TEMPERATURE_FORM_ID}-corrective-action`}
                  aria-invalid={fieldState.invalid}
                  placeholder={t(
                    "temperatureDialog.correctiveActionPlaceholder",
                  )}
                  className="min-h-24 resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  {t("temperatureDialog.correctiveActionHint")}
                </p>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        )}
      </form>
    </ResponsiveFormDialog>
  );
}
