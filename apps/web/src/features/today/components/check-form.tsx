"use client";

import type {
  AnswersInput,
  CorrectiveInput,
  FormDefinition,
  RecordValues,
  ResolvedLimits,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AnswerFields } from "@/features/forms/components/answer-fields";
import { useRecordEntry } from "../hooks/use-record-entry";
import { CorrectivePanel } from "./corrective-panel";

type Props = {
  /** Unique per check, so moving to the next one starts from its own answers. */
  entryKey: string;
  definition: FormDefinition;
  limits: ResolvedLimits;
  initialValues: RecordValues | null;
  initialCorrective: CorrectiveInput | null;
  saveLabel: string;
  disabled?: boolean;
  /** Sits beside Save, e.g. a way back out of an unsaved entry. */
  secondary?: ReactNode;
  onSubmit: (
    values: AnswersInput,
    corrective?: CorrectiveInput,
  ) => Promise<boolean>;
};

/** One check's whole form: every field on its own row, then what was done if it fails. */
export function CheckForm({
  entryKey,
  definition,
  limits,
  initialValues,
  initialCorrective,
  saveLabel,
  disabled = false,
  secondary,
  onSubmit,
}: Props) {
  const t = useTranslations("TodayPage.recordDialog");
  const idPrefix = `check-${entryKey}`;

  const entry = useRecordEntry({
    entryKey,
    definition,
    limits,
    initialValues,
    initialCorrective,
    onSubmit,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void entry.pressPrimary();
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5 max-xl:flex-1"
      onSubmit={handleSubmit}
      data-testid="check-form"
    >
      <fieldset
        disabled={disabled || entry.isSubmitting}
        className="flex min-w-0 flex-col gap-5"
      >
        <AnswerFields
          idPrefix={idPrefix}
          definition={definition}
          limits={limits}
          draft={entry.draft}
          issues={entry.issues}
          separator={entry.separator}
          onChange={entry.changeField}
        />

        {entry.showCorrective ? (
          <CorrectivePanel
            idPrefix={idPrefix}
            settings={entry.correctiveSettings}
            selected={entry.answerIds}
            onToggle={entry.toggleAnswer}
            error={entry.correctiveError}
            required={entry.correctiveRequired}
            notes={entry.notes}
            onNotesChange={entry.setNotes}
            notesError={entry.notesError}
          />
        ) : null}
      </fieldset>

      <div className="flex flex-wrap gap-2 max-xl:sticky max-xl:mt-auto max-xl:bottom-0 max-xl:-mx-4 max-xl:border-t max-xl:bg-popover max-xl:px-4 max-xl:pt-3 max-xl:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <Button
          type="submit"
          disabled={disabled}
          isLoading={entry.isSubmitting}
          className="max-xl:h-12 max-xl:flex-1"
          data-testid="record-save"
        >
          {entry.showCorrective ? t("saveDeviation") : saveLabel}
        </Button>
        {secondary}
      </div>
    </form>
  );
}
