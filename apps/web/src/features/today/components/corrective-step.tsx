"use client";

import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { AnswerLine } from "@/features/forms/lib/answer-summary";
import { cn } from "@/lib/utils";
import {
  NOTES_MAX_LENGTH,
  type CorrectivePresetKey,
} from "../lib/corrective-action";

type Props = {
  idPrefix: string;
  /** The answers that failed, so the person sees what they are responding to. */
  failures: AnswerLine[];
  presetKeys: readonly CorrectivePresetKey[];
  presets: readonly CorrectivePresetKey[];
  onTogglePreset: (key: CorrectivePresetKey) => void;
  presetsError?: string | null;
  required: boolean;
  notes: string;
  onNotesChange: (next: string) => void;
  notesError?: string | null;
  className?: string;
};

/** Separate step: unfolding below the answers shoved the form while still typing. */
export function CorrectiveStep({
  idPrefix,
  failures,
  presetKeys,
  presets,
  onTogglePreset,
  presetsError,
  required,
  notes,
  onNotesChange,
  notesError,
  className,
}: Props) {
  const t = useTranslations("TodayPage.recordDialog");
  const notesId = `${idPrefix}-notes`;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
      <div className="flex shrink-0 flex-col gap-1.5 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <CircleAlertIcon className="size-5 text-destructive" aria-hidden />
          {t("failedTitle")}
        </div>
        <ul className="flex flex-col gap-0.5 text-sm">
          {failures.map((line) => (
            <li key={line.fieldId} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{line.label}</span>
              <span className="font-semibold tabular-nums">{line.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <Field data-invalid={Boolean(presetsError)} className="shrink-0">
        <FieldTitle>
          {required ? t("correctiveTitle") : t("correctiveTitleOptional")}
        </FieldTitle>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {presetKeys.map((key) => {
            const active = presets.includes(key);
            return (
              <Button
                key={key}
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                className="relative h-auto min-h-12 w-full justify-center px-3 py-2 text-center text-sm leading-snug whitespace-normal"
                onClick={() => onTogglePreset(key)}
              >
                {active ? (
                  <CheckIcon
                    className="absolute top-1/2 left-3 size-4 -translate-y-1/2 shrink-0"
                    aria-hidden
                  />
                ) : null}
                {t(`presets.${key}`)}
              </Button>
            );
          })}
        </div>

        {presetsError ? (
          <FieldError errors={[{ message: presetsError }]} />
        ) : null}
      </Field>

      <Field data-invalid={Boolean(notesError)} className="min-h-0 flex-1 px-1">
        <FieldLabel htmlFor={notesId}>{t("notesLabel")}</FieldLabel>
        <Textarea
          id={notesId}
          value={notes}
          maxLength={NOTES_MAX_LENGTH}
          aria-invalid={Boolean(notesError)}
          placeholder={t("notesPlaceholder")}
          // Shared grid cell with the answers step — a growing textarea would resize both.
          className="min-h-20 flex-1 resize-none field-sizing-fixed md:h-24 md:min-h-0 md:flex-none"
          onChange={(event) => onNotesChange(event.target.value)}
        />
        {notesError ? (
          <FieldError errors={[{ message: notesError }]} />
        ) : (
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("notesCharacterCount", {
              current: notes.length,
              max: NOTES_MAX_LENGTH,
            })}
          </p>
        )}
      </Field>
    </div>
  );
}
