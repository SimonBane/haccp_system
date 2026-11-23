"use client";

import type { CorrectiveSettings } from "@haccp/shared";
import { useTranslations } from "next-intl";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { CorrectiveAnswers } from "@/features/forms/components/corrective-answers";
import { correctiveNoteShown } from "@/features/forms/lib/form-builder";
import { NOTES_MAX_LENGTH } from "../lib/corrective-action";

type Props = {
  idPrefix: string;
  settings: CorrectiveSettings;
  selected: readonly string[];
  onToggle: (answerId: string) => void;
  error?: string | null;
  required: boolean;
  notes: string;
  onNotesChange: (next: string) => void;
  notesError?: string | null;
};

/** Shown under the answers once a failing check is saved, so the record carries what was done about it. */
export function CorrectivePanel({
  idPrefix,
  settings,
  selected,
  onToggle,
  error,
  required,
  notes,
  onNotesChange,
  notesError,
}: Props) {
  const t = useTranslations("TodayPage");
  const notesId = `${idPrefix}-notes`;
  const titleId = `${idPrefix}-title`;
  const hasAnswers = settings.answers.length > 0;
  const title = required
    ? t("recordDialog.correctiveTitle")
    : t("recordDialog.correctiveTitleOptional");

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4"
      data-testid="corrective-panel"
    >
      <Field data-invalid={Boolean(error)}>
        <FieldTitle id={titleId}>{title}</FieldTitle>
        {hasAnswers ? (
          <CorrectiveAnswers
            answers={settings.answers}
            multiple={settings.multiple}
            selected={selected}
            ariaLabel={title}
            onToggle={onToggle}
          />
        ) : null}
        {error ? <FieldError errors={[{ message: error }]} /> : null}
      </Field>

      {correctiveNoteShown(settings) ? (
        <Field data-invalid={Boolean(notesError)}>
          {hasAnswers ? (
            <FieldLabel htmlFor={notesId}>
              {t("recordDialog.notesLabel")}
            </FieldLabel>
          ) : null}
          <Textarea
            id={notesId}
            aria-labelledby={hasAnswers ? undefined : titleId}
            value={notes}
            maxLength={NOTES_MAX_LENGTH}
            aria-invalid={Boolean(notesError)}
            placeholder={
              hasAnswers
                ? t("recordDialog.notesPlaceholder")
                : t("recordDialog.noteOnlyPlaceholder")
            }
            className="min-h-16 bg-background"
            onChange={(event) => onNotesChange(event.target.value)}
          />
          {notesError ? (
            <FieldError errors={[{ message: notesError }]} />
          ) : null}
        </Field>
      ) : null}
    </div>
  );
}
