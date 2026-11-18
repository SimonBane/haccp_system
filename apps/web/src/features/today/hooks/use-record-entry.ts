"use client";

import {
  CORRECTIVE_ACTION_MODE,
  RECORD_RESULT,
  type AnswersInput,
  type FormDefinition,
  type RecordValues,
  type ResolvedLimits,
} from "@haccp/shared";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  createAnswerDraft,
  draftToAnswers,
  evaluateAnswerDraft,
  validateAnswerDraft,
  type AnswerDraft,
  type FieldDraft,
} from "@/features/forms/lib/answer-draft";
import { decimalSeparator } from "@/features/forms/lib/measurement";
import {
  composeCorrectiveAction,
  NOTES_MAX_LENGTH,
  type CorrectivePresetKey,
} from "../lib/corrective-action";

export type RecordEntryStep = "answers" | "corrective";

const EMPTY_DEFINITION: FormDefinition = {
  fields: [],
  correctiveAction: CORRECTIVE_ACTION_MODE.OPTIONAL,
};

type Params = {
  occurrenceKey: string;
  definition: FormDefinition | null;
  limits: ResolvedLimits;
  /** An edit starts from the saved answers; a new record from blanks. */
  initialValues: RecordValues | null;
  onSubmit: (
    values: AnswersInput,
    correctiveAction?: string,
  ) => Promise<boolean>;
};

/**
 * Entry as plain state: react-hook-form's reset cannot run during render, which
 * advancing to the next check in a round needs.
 */
export function useRecordEntry({
  occurrenceKey,
  definition: maybeDefinition,
  limits,
  initialValues,
  onSubmit,
}: Params) {
  const t = useTranslations("TodayPage.recordDialog");
  const locale = useLocale();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);
  const definition = maybeDefinition ?? EMPTY_DEFINITION;

  const freshDraft = () =>
    createAnswerDraft(definition, limits, initialValues, separator);

  const [step, setStep] = useState<RecordEntryStep>("answers");
  const [draft, setDraft] = useState<AnswerDraft>(freshDraft);
  const [presets, setPresets] = useState<CorrectivePresetKey[]>([]);
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset during render so the next check never flashes the answers just saved.
  const [resetFor, setResetFor] = useState(occurrenceKey);
  if (resetFor !== occurrenceKey) {
    setResetFor(occurrenceKey);
    setStep("answers");
    setDraft(freshDraft());
    setPresets([]);
    setNotes("");
    setShowErrors(false);
  }

  const issues = validateAnswerDraft(definition, draft);
  const evaluated = evaluateAnswerDraft(definition, limits, draft);
  const hasIssues = Object.keys(issues).length > 0;
  const isFailing = evaluated.result === RECORD_RESULT.FAIL;
  const correctiveRequired =
    definition.correctiveAction === CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL;

  const notesError =
    notes.length > NOTES_MAX_LENGTH ? t("validation.notesMax") : null;

  const correctiveError =
    correctiveRequired && presets.length === 0 && notes.trim().length === 0
      ? t("validation.correctiveRequired")
      : null;

  function changeField(fieldId: string, next: FieldDraft) {
    setDraft((current) => ({ ...current, [fieldId]: next }));
  }

  async function submit(correctiveAction?: string) {
    setIsSubmitting(true);
    try {
      await onSubmit(draftToAnswers(definition, draft), correctiveAction);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function pressPrimary() {
    setShowErrors(true);
    if (hasIssues) return;

    if (step === "answers") {
      if (isFailing) {
        setShowErrors(false);
        setStep("corrective");
        return;
      }
      await submit();
      return;
    }

    if (notesError || correctiveError) return;

    const labels = presets.map((key) => t(`presets.${key}`));
    await submit(composeCorrectiveAction(labels, notes) || undefined);
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
    goToAnswers: () => setStep("answers"),
    draft,
    changeField,
    separator,
    evaluated,
    isFailing,
    hasIssues,
    correctiveRequired,
    presets,
    togglePreset,
    notes,
    setNotes,
    isSubmitting,
    pressPrimary,
    issues: showErrors ? issues : {},
    notesError: showErrors ? notesError : null,
    correctiveError: showErrors ? correctiveError : null,
  };
}

export type RecordEntry = ReturnType<typeof useRecordEntry>;
