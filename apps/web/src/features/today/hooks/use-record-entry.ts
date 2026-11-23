"use client";

import {
  asksForCorrectiveAction,
  CORRECTIVE_ACTION_MODE,
  correctiveSettings,
  RECORD_RESULT,
  resolveCorrective,
  type AnswersInput,
  type CorrectiveInput,
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
import { toggleCorrectiveAnswer } from "@/features/forms/lib/corrective-answers";
import { correctiveNoteShown } from "@/features/forms/lib/form-builder";
import { decimalSeparator } from "@/features/forms/lib/measurement";
import { NOTES_MAX_LENGTH } from "../lib/corrective-action";

const EMPTY_DEFINITION: FormDefinition = {
  fields: [],
  correctiveAction: CORRECTIVE_ACTION_MODE.OPTIONAL,
};

type Params = {
  /** Changes when another check takes the form's place, which resets it. */
  entryKey: string;
  definition: FormDefinition | null;
  limits: ResolvedLimits;
  /** An edit starts from the saved answers; a new record from blanks. */
  initialValues: RecordValues | null;
  initialCorrective: CorrectiveInput | null;
  onSubmit: (
    values: AnswersInput,
    corrective?: CorrectiveInput,
  ) => Promise<boolean>;
};

/** Entry as plain state: react-hook-form's reset cannot run during render, which moving to the next check needs. */
export function useRecordEntry({
  entryKey,
  definition: maybeDefinition,
  limits,
  initialValues,
  initialCorrective,
  onSubmit,
}: Params) {
  const t = useTranslations("TodayPage.recordDialog");
  const locale = useLocale();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);
  const definition = maybeDefinition ?? EMPTY_DEFINITION;

  const freshDraft = () =>
    createAnswerDraft(definition, limits, initialValues, separator);

  const [draft, setDraft] = useState<AnswerDraft>(freshDraft);
  const settings = correctiveSettings(definition);
  const noteShown = correctiveNoteShown(settings);
  const [askedForAction, setAskedForAction] = useState(
    initialCorrective !== null,
  );
  const [answerIds, setAnswerIds] = useState<string[]>(() => [
    ...(initialCorrective?.answerIds ?? []),
  ]);
  const [notes, setNotes] = useState(initialCorrective?.note ?? "");
  const [showErrors, setShowErrors] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset during render so the next check never flashes the answers just saved.
  const [resetFor, setResetFor] = useState(entryKey);
  if (resetFor !== entryKey) {
    setResetFor(entryKey);
    setDraft(freshDraft());
    setAskedForAction(initialCorrective !== null);
    setAnswerIds([...(initialCorrective?.answerIds ?? [])]);
    setNotes(initialCorrective?.note ?? "");
    setShowErrors(false);
  }

  const issues = validateAnswerDraft(definition, draft);
  const evaluated = evaluateAnswerDraft(definition, limits, draft);
  const hasIssues = Object.keys(issues).length > 0;
  const isFailing = evaluated.result === RECORD_RESULT.FAIL;
  const asksForAction = asksForCorrectiveAction(definition);
  const showCorrective = askedForAction && isFailing && asksForAction;
  const correctiveRequired =
    definition.correctiveAction === CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL;

  // A note typed before the form stopped taking one is not sent: the server would refuse it.
  const corrective: CorrectiveInput = {
    answerIds,
    note: noteShown ? notes : "",
  };

  const notesError =
    noteShown && notes.length > NOTES_MAX_LENGTH
      ? t("validation.notesMax")
      : null;

  const correctiveError =
    resolveCorrective(definition, corrective).issue === "required"
      ? t("validation.correctiveRequired")
      : null;

  function changeField(fieldId: string, next: FieldDraft) {
    setDraft((current) => ({ ...current, [fieldId]: next }));
  }

  async function submit(sent?: CorrectiveInput) {
    setIsSubmitting(true);
    try {
      await onSubmit(draftToAnswers(definition, draft), sent);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function pressPrimary() {
    setShowErrors(true);
    if (hasIssues) return;

    if (!isFailing || !asksForAction) {
      await submit();
      return;
    }

    if (!showCorrective) {
      setShowErrors(false);
      setAskedForAction(true);
      return;
    }

    if (notesError || correctiveError) return;

    await submit(corrective);
  }

  function toggleAnswer(answerId: string) {
    setAnswerIds((current) =>
      toggleCorrectiveAnswer(current, answerId, settings.multiple),
    );
  }

  return {
    draft,
    changeField,
    separator,
    evaluated,
    isFailing,
    showCorrective,
    correctiveRequired,
    correctiveSettings: settings,
    answerIds,
    toggleAnswer,
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
