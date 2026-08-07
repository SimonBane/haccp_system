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
  /** Identity of the check being recorded. Changing it starts a fresh entry. */
  occurrenceKey: string;
  minTempC: number;
  maxTempC: number;
  onSubmit: (recordedC: number, correctiveAction?: string) => Promise<boolean>;
};

/**
 * One reading: its value, its sign, and which step of the entry it is on.
 *
 * Deliberately plain state rather than react-hook-form. The three fields here
 * are driven by a custom keypad, so the form library was already reduced to
 * `setValue` plus `useWatch`, and its `reset` cannot run during render — which
 * is exactly what advancing to the next check in a round needs to do. Three
 * rules derived inline are shorter than the resolver they replace, and the
 * schema that actually guards the data still lives in `@haccp/shared`.
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

  // Advancing to the next check swaps every input on the screen. Resetting
  // during render rather than in an effect puts the new equipment's name and an
  // empty readout in the same paint; an effect would show one frame of the
  // reading just saved against the next fridge's name.
  const [resetFor, setResetFor] = useState(occurrenceKey);
  if (resetFor !== occurrenceKey) {
    setResetFor(occurrenceKey);
    setStep("reading");
    // Re-inferred from the *new* check's range: a freezer followed by a fridge
    // in one round has to flip the pill from − to +.
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
    // Keeps the sign pill honest when a minus arrives from somewhere else, such
    // as the desktop field or a paste. An empty draft keeps the last sign.
    if (next.startsWith("-")) setSign(-1);
    else if (next !== "") setSign(1);
  }

  function changeDigits(nextDigits: string) {
    changeDraft(composeSignedDraft(sign, nextDigits));
  }

  function changeSign(next: 1 | -1) {
    // The sign has to be stored as well as applied: an empty field has no
    // leading minus to read it back from.
    setSign(next);
    setDraft(composeSignedDraft(next, digits));
  }

  async function submit(value: number, correctiveAction?: string) {
    setIsSubmitting(true);
    try {
      // Normalises "-0" to 0.
      await onSubmit(value + 0, correctiveAction);
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * The one commit action. On the reading step it either advances to the
   * deviation step or saves; on the deviation step it saves.
   */
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
    /** Errors surface only once the worker has asked to move on. */
    readingError: showErrors ? readingError : null,
    notesError: showErrors ? notesError : null,
    correctiveError: showErrors ? correctiveError : null,
  };
}

export type TemperatureEntry = ReturnType<typeof useTemperatureEntry>;
export type { TemperatureVerdict };
