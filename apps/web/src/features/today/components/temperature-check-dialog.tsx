"use client";

import { classifyTemperatureResult } from "@haccp/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useOrgTimeZone } from "@/features/tenant/use-org-timezone";
import { cn } from "@/lib/utils";
import { useSettledReading } from "../hooks/use-settled-reading";
import { decimalSeparator } from "../lib/format";
import {
  TEMP_MAX_MAGNITUDE,
  composeCorrectiveAction,
  inferTemperatureSign,
  parseTemperatureDraft,
} from "../lib/temperature";
import type { TodayTimelineItem } from "../lib/today-timeline";
import {
  CORRECTIVE_PRESET_KEYS,
  NOTES_MAX_LENGTH,
  TemperatureCorrectiveStep,
  type CorrectivePresetKey,
} from "./temperature-corrective-step";
import { TemperatureEntryShell } from "./temperature-entry-shell";
import { TemperatureReadingStep } from "./temperature-reading-step";

const ID_PREFIX = "temperature-check";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TodayTimelineItem;
  minTempC: number;
  maxTempC: number;
  onConfirm: (recordedC: number, correctiveAction?: string) => Promise<void>;
};

function isPresetKey(value: string): value is CorrectivePresetKey {
  return (CORRECTIVE_PRESET_KEYS as readonly string[]).includes(value);
}

export function TemperatureCheckDialog({
  open,
  onOpenChange,
  item,
  minTempC,
  maxTempC,
  onConfirm,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();
  const timeZone = useOrgTimeZone();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const readingStepRef = useRef<HTMLDivElement>(null);
  const correctiveStepRef = useRef<HTMLDivElement>(null);
  const hasChangedStep = useRef(false);

  const { task } = item;

  const [step, setStep] = useState<"reading" | "corrective">("reading");
  // Reopening the dialog remounts it, so inferring once on mount is enough.
  const [sign, setSign] = useState<1 | -1>(() =>
    inferTemperatureSign(minTempC, maxTempC),
  );

  const formSchema = useMemo(
    () =>
      z
        .object({
          recordedC: z
            .string()
            .min(1, t("temperatureDialog.validation.required"))
            .superRefine((value, context) => {
              const parsed = parseTemperatureDraft(value);
              if (parsed === null) {
                context.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("temperatureDialog.validation.invalid"),
                });
                return;
              }
              if (Math.abs(parsed) > TEMP_MAX_MAGNITUDE) {
                context.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t("temperatureDialog.validation.outOfBounds"),
                });
              }
            }),
          presets: z.array(z.string()),
          notes: z
            .string()
            .trim()
            .max(
              NOTES_MAX_LENGTH,
              t("temperatureDialog.validation.correctiveActionMax"),
            ),
        })
        .superRefine((values, context) => {
          const parsed = parseTemperatureDraft(values.recordedC);
          if (parsed === null) return;
          if (
            classifyTemperatureResult({
              recordedC: parsed,
              minTempC,
              maxTempC,
            }) !== "out_of_range"
          ) {
            return;
          }
          if (values.presets.length === 0 && values.notes.trim().length === 0) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["presets"],
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
    defaultValues: { recordedC: "", presets: [], notes: "" },
    mode: "onTouched",
  });

  const recordedC = useWatch({ control: form.control, name: "recordedC" });
  const presets = useWatch({ control: form.control, name: "presets" });
  const notes = useWatch({ control: form.control, name: "notes" });
  const { errors, isSubmitting, isSubmitted } = form.formState;

  const parsed = parseTemperatureDraft(recordedC);
  const { settled: settledDraft, flush } = useSettledReading(recordedC);
  const settledValue = parseTemperatureDraft(settledDraft);
  const verdict =
    settledValue === null
      ? null
      : classifyTemperatureResult({
          recordedC: settledValue,
          minTempC,
          maxTempC,
        });

  // Marking the outgoing step inert evicts whatever held focus, and the browser
  // hands it to the next control it finds — the notes textarea, which opens the
  // phone keyboard over the corrective options nobody asked to skip. Land on the
  // step itself instead, so the keyboard only appears once notes are tapped.
  useEffect(() => {
    if (!hasChangedStep.current) {
      hasChangedStep.current = true;
      return;
    }
    const target =
      step === "reading" ? readingStepRef.current : correctiveStepRef.current;
    target?.focus();
  }, [step]);

  function handleValueChange(next: string) {
    form.setValue("recordedC", next, { shouldValidate: isSubmitted });
    // Keeps the mobile sign control honest when a minus arrives from elsewhere,
    // such as the desktop field or a paste. An empty draft keeps the last sign.
    if (next.startsWith("-")) setSign(-1);
    else if (next !== "") setSign(1);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isSubmitting) return;
    onOpenChange(nextOpen);
  }

  async function handleValidSubmit(values: FormValues) {
    const value = parseTemperatureDraft(values.recordedC);
    if (value === null) return;

    const labels = values.presets
      .filter(isPresetKey)
      .map((key) => t(`temperatureDialog.presets.${key}`));

    await onConfirm(
      // Normalises "-0" to 0.
      value + 0,
      composeCorrectiveAction(labels, values.notes) || undefined,
    );
  }

  async function handlePrimary() {
    if (!(await form.trigger("recordedC"))) return;

    const value = parseTemperatureDraft(form.getValues("recordedC"));
    if (value === null) return;

    // Re-derived from the live value rather than the debounced verdict, so a
    // badge that has not caught up yet can never wave a deviation through.
    const isDeviation =
      classifyTemperatureResult({ recordedC: value, minTempC, maxTempC }) ===
      "out_of_range";

    if (step === "reading" && isDeviation) {
      flush();
      setStep("corrective");
      return;
    }

    await form.handleSubmit(handleValidSubmit)();
  }

  const isReading = step === "reading";
  const primaryIcon =
    isReading && verdict === "out_of_range" ? "continue" : "confirm";
  const primaryLabel =
    primaryIcon === "continue"
      ? t("temperatureDialog.continueLabel")
      : t("temperatureDialog.confirm");

  return (
    <TemperatureEntryShell
      open={open}
      onOpenChange={handleOpenChange}
      title={task.title}
      subtitle={
        task.equipmentName
          ? `${task.equipmentName} · ${task.scheduledTime}`
          : task.scheduledTime
      }
      leading={isReading ? "close" : "back"}
      leadingLabel={
        isReading ? t("temperatureDialog.close") : t("temperatureDialog.back")
      }
      onLeading={() =>
        isReading ? handleOpenChange(false) : setStep("reading")
      }
      primaryIcon={primaryIcon}
      primaryLabel={primaryLabel}
      primaryDisabled={parsed === null}
      primaryLoading={isSubmitting}
      onPrimary={() => void handlePrimary()}
      desktopInitialFocus={desktopInputRef}
    >
      {/* Both steps share one grid cell, so neither can resize the other. On a
          phone the cell is the viewport minus the app bar; on desktop the row
          sizes to the taller step and then stays there, so the dialog does not
          jump when the flow advances. */}
      <form
        className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 md:flex-none"
        onSubmit={(event) => {
          event.preventDefault();
          void handlePrimary();
        }}
      >
        <div
          ref={readingStepRef}
          tabIndex={-1}
          className={cn(
            "col-start-1 row-start-1 flex min-h-0 flex-col outline-none transition-opacity duration-150 motion-reduce:transition-none",
            isReading ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          inert={!isReading}
        >
          <TemperatureReadingStep
            idPrefix={ID_PREFIX}
            minTempC={minTempC}
            maxTempC={maxTempC}
            value={recordedC}
            onValueChange={handleValueChange}
            valueError={errors.recordedC?.message}
            onValueBlur={() => void form.trigger("recordedC")}
            sign={sign}
            onSignChange={setSign}
            separator={separator}
            verdict={verdict}
            settledValue={settledValue}
            priorReading={item.priorReading}
            timeZone={timeZone}
            desktopInputRef={desktopInputRef}
          />
        </div>

        <div
          ref={correctiveStepRef}
          tabIndex={-1}
          className={cn(
            "col-start-1 row-start-1 flex min-h-0 flex-col overflow-y-auto outline-none transition-opacity duration-150 motion-reduce:transition-none",
            isReading ? "pointer-events-none opacity-0" : "opacity-100",
          )}
          inert={isReading}
        >
          <TemperatureCorrectiveStep
            idPrefix={ID_PREFIX}
            recordedC={parsed}
            presets={presets}
            onPresetsChange={(next) =>
              form.setValue("presets", next, { shouldValidate: isSubmitted })
            }
            presetsError={errors.presets?.message}
            notes={notes}
            onNotesChange={(next) =>
              form.setValue("notes", next, { shouldValidate: isSubmitted })
            }
            notesError={errors.notes?.message}
            onNotesBlur={() => void form.trigger("notes")}
          />
        </div>
      </form>
    </TemperatureEntryShell>
  );
}
