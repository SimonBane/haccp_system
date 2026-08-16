"use client";

import { classifyTemperatureResult } from "@haccp/shared";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { decimalSeparator } from "../lib/format";
import {
  composeCorrectiveAction,
  composeSignedDraft,
  inferTemperatureSign,
  NOTES_MAX_LENGTH,
  parseTemperatureDraft,
  TEMP_MAX_MAGNITUDE,
  type CorrectivePresetKey,
  type TemperatureVerdict,
} from "../lib/temperature";

export type TemperatureEntryStep = "reading" | "deviation";

type Params = {
  occurrenceKey: string;
  minTempC: number;
  maxTempC: number;
  onSubmit: (recordedC: number, correctiveAction?: string) => Promise<boolean>;
};

/**
 * Reading entry as plain state: react-hook-form's reset cannot run during
 * render, which advancing to the next check needs.
 */
export function useTemperatureEntry({
  occurrenceKey,
  minTempC,
  maxTempC,
  onSubmit,
}: Params) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);

  const [step, setStep] = useState<TemperatureEntryStep>("reading");
  const [sign, setSign] = useState<1 | -1>(() =>
    inferTemperatureSign(minTempC, maxTempC),
  );
  const [draft, setDraft] = useState("");
  const [presets, setPresets] = useState<CorrectivePresetKey[]>([]);
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset during render so the next fridge never flashes the reading just saved.
  const [resetFor, setResetFor] = useState(occurrenceKey);
  if (resetFor !== occurrenceKey) {
    setResetFor(occurrenceKey);
    setStep("reading");
    // Infer from the new range so a freezer-then-fridge round flips the pill.
    setSign(inferTemperatureSign(minTempC, maxTempC));
    setDraft("");
    setPresets([]);
    setNotes("");
    setShowErrors(false);
  }

  const parsed = parseTemperatureDraft(draft);
  const digits = draft.replace(/^-/, "");

  const readingError = (() => {
    if (draft.trim().length === 0) {
      return t("temperatureDialog.validation.required");
    }
    if (parsed === null) return t("temperatureDialog.validation.invalid");
    if (Math.abs(parsed) > TEMP_MAX_MAGNITUDE) {
      return t("temperatureDialog.validation.outOfBounds");
    }
    return null;
  })();

  const notesError =
    notes.length > NOTES_MAX_LENGTH
      ? t("temperatureDialog.validation.correctiveActionMax")
      : null;

  const correctiveError =
    presets.length === 0 && notes.trim().length === 0
      ? t("temperatureDialog.validation.correctiveActionRequired")
      : null;

  function changeDraft(next: string) {
    setDraft(next);
    // A leading minus from paste/desktop flips the pill; an empty draft keeps the last sign.
    if (next.startsWith("-")) setSign(-1);
    else if (next !== "") setSign(1);
  }

  function changeDigits(nextDigits: string) {
    changeDraft(composeSignedDraft(sign, nextDigits));
  }

  function changeSign(next: 1 | -1) {
    // Stored separately: an empty field has no leading minus to read back.
    setSign(next);
    setDraft(composeSignedDraft(next, digits));
  }

  async function submit(value: number, correctiveAction?: string) {
    setIsSubmitting(true);
    try {
      await onSubmit(value + 0, correctiveAction); // Coerce -0 to 0.
    } finally {
      setIsSubmitting(false);
    }
  }

  async function pressPrimary() {
    setShowErrors(true);

    if (parsed === null || readingError) return;

    if (step === "reading") {
      const isDeviation =
        classifyTemperatureResult({ recordedC: parsed, minTempC, maxTempC }) ===
        "out_of_range";

      if (isDeviation) {
        setShowErrors(false);
        setStep("deviation");
        return;
      }

      await submit(parsed);
      return;
    }

    if (notesError || correctiveError) return;

    const labels = presets.map((key) => t(`temperatureDialog.presets.${key}`));
    await submit(parsed, composeCorrectiveAction(labels, notes) || undefined);
  }

  function togglePreset(key: CorrectivePresetKey) {
    setPresets((current) =>
      current.includes(key)
        ? current.filter((preset) => preset !== key)
        : [...current, key],
    );
  }

  return {
    step,
    goToReading: () => setStep("reading"),
    sign,
    changeSign,
    draft,
    digits,
    changeDraft,
    changeDigits,
    parsed,
    separator,
    presets,
    togglePreset,
    notes,
    setNotes,
    isSubmitting,
    pressPrimary,
    readingError: showErrors ? readingError : null,
    notesError: showErrors ? notesError : null,
    correctiveError: showErrors ? correctiveError : null,
  };
}

export type TemperatureEntry = ReturnType<typeof useTemperatureEntry>;
export type { TemperatureVerdict };
