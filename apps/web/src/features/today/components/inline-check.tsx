"use client";

import {
  asksForCorrectiveAction,
  CORRECTIVE_ACTION_MODE,
  correctiveSettings,
  FIELD_TYPE,
  resolveCorrective,
  TEXT_ANSWER_MAX_LENGTH,
  type AnswersInput,
  type CorrectiveInput,
  type FormField,
  type FormVersionSummary,
} from "@haccp/shared";
import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useMemo,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CorrectiveAnswers } from "@/features/forms/components/corrective-answers";
import { LimitChip } from "@/features/forms/components/limit-chip";
import { MeasurementInput } from "@/features/forms/components/measurement-input";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import {
  limitsFor,
  measurementDraftValue,
  type FieldDraft,
} from "@/features/forms/lib/answer-draft";
import { correctiveNoteShown } from "@/features/forms/lib/form-builder";
import {
  decimalSeparator,
  measurementVerdict,
} from "@/features/forms/lib/measurement";
import { cn } from "@/lib/utils";
import { useInlineDraft } from "../hooks/use-inline-draft";
import { NOTES_MAX_LENGTH } from "../lib/corrective-action";
import {
  inlineAnswers,
  inlineOptions,
  isOptionSelected,
  type InlineDrafts,
  type InlineRow,
} from "../lib/inline-check";
import {
  groupChecksByArea,
  type TodayCheck,
  type TodayGroup,
} from "../lib/today-day";

export type CheckSave = {
  check: TodayCheck;
  values: AnswersInput;
  corrective?: CorrectiveInput;
};

type Props = {
  group: TodayGroup;
  form: FormVersionSummary;
  field: FormField;
  drafts: InlineDrafts;
  setDrafts: Dispatch<SetStateAction<InlineDrafts>>;
  /** Resolves with the keys of the checks that were saved. */
  onSaveAll: (saves: CheckSave[]) => Promise<string[]>;
  onComplete: () => void;
};

const EMPTY_READING = {
  type: FIELD_TYPE.MEASUREMENT,
  sign: 1,
  digits: "",
} as const;

function controlId(key: string): string {
  return `inline-${key}`;
}

/** A form with one control, answered on each item's row; nothing is saved until Done. */
export function InlineCheck({
  group,
  form,
  field,
  drafts,
  setDrafts,
  onSaveAll,
  onComplete,
}: Props) {
  const t = useTranslations("TodayPage");
  const tForms = useTranslations("Forms");
  const format = useAnswerFormat();
  const separator = useMemo(
    () => decimalSeparator(format.locale),
    [format.locale],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const draft = useInlineDraft({
    group,
    definition: form.definition,
    field,
    separator,
    drafts,
    setDrafts,
  });

  const options = inlineOptions(field);
  const corrective = correctiveSettings(form.definition);
  const noteShown = correctiveNoteShown(corrective);
  const correctiveOf = (row: InlineRow): CorrectiveInput => ({
    answerIds: row.answerIds,
    note: noteShown ? row.note : "",
  });
  const asksForAction = asksForCorrectiveAction(form.definition);
  const correctiveRequired =
    form.definition.correctiveAction ===
    CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL;

  const byKey = new Map(draft.rows.map((row) => [row.check.key, row]));
  const ready = draft.rows.filter((row) => row.isReady);
  const invalid = draft.rows.filter((row) => row.issue !== null);
  const unanswered = draft.rows.filter((row) => row.isEmpty).length;
  const hasDrafts = draft.rows.some((row) => row.hasDraft);
  const missesAction = ready.some(
    (row) =>
      row.fails &&
      resolveCorrective(form.definition, correctiveOf(row)).issue ===
        "required",
  );
  const isLocked = group.isLocked;
  const showCompleteAll = draft.canCompleteAll && unanswered > 0;
  const showDone = !showCompleteAll && (ready.length > 0 || invalid.length > 0);

  const areas = groupChecksByArea(group.checks, {
    wholeRoom: t("room.wholeRoom"),
    fallback: group.title,
  });
  const order = areas.flatMap((area) => area.rows.map((row) => row.check.key));

  /** Enter moves down the list, so a round of readings never needs the mouse. */
  function handleEnter(event: KeyboardEvent<HTMLInputElement>, key: string) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = order[order.indexOf(key) + 1];
    if (next) document.getElementById(controlId(next))?.focus();
    else event.currentTarget.blur();
  }

  async function handleDone() {
    const [firstInvalid] = invalid;
    if (firstInvalid) {
      setShowIssues(true);
      document.getElementById(controlId(firstInvalid.check.key))?.focus();
      return;
    }
    setIsSaving(true);
    try {
      const saved = await onSaveAll(
        ready.map((row) => ({
          check: row.check,
          values: inlineAnswers(form.definition, field, row.value),
          corrective:
            row.fails && asksForAction ? correctiveOf(row) : undefined,
        })),
      );
      draft.forget(saved);
      setShowIssues(false);
      if (saved.length === ready.length) onComplete();
    } finally {
      setIsSaving(false);
    }
  }

  function handleReset() {
    draft.reset();
    setShowIssues(false);
  }

  function control(row: InlineRow, label: string) {
    const { check, value } = row;
    const id = controlId(check.key);
    const disabled = isLocked || isSaving;
    const enterKeyHint =
      order.indexOf(check.key) < order.length - 1 ? "next" : "done";
    const invalidShown = showIssues && row.issue !== null;
    const set = (next: FieldDraft) => draft.change(check.key, next);

    if (options) {
      return (
        <div role="group" aria-label={label} className="flex flex-wrap gap-2">
          {options.map((option) => {
            const selected = isOptionSelected(value, option.id);
            return (
              <Button
                key={option.id}
                variant="outline"
                aria-pressed={selected}
                disabled={disabled}
                className={cn(
                  "h-11 px-3.5 md:h-8",
                  selected &&
                    (option.fails
                      ? "border-destructive bg-destructive text-white hover:bg-destructive/90 hover:text-white dark:border-destructive dark:bg-destructive dark:hover:bg-destructive/90"
                      : "border-success bg-success text-success-foreground hover:bg-success/90 hover:text-success-foreground dark:border-success dark:bg-success dark:hover:bg-success/90"),
                )}
                onClick={() => draft.choose(check.key, option.id)}
              >
                {selected ? (
                  option.fails ? (
                    <CircleAlertIcon data-icon="inline-start" />
                  ) : (
                    <CheckIcon data-icon="inline-start" />
                  )
                ) : null}
                {option.label}
              </Button>
            );
          })}
        </div>
      );
    }

    if (field.type === FIELD_TYPE.CHOICE) {
      const selected = value.type === FIELD_TYPE.CHOICE ? value.value : [];
      return (
        <Select
          items={field.options.map((option) => ({
            label: option.label,
            value: option.id,
          }))}
          value={selected[0] ?? null}
          disabled={disabled}
          onValueChange={(next: unknown) =>
            set({
              type: FIELD_TYPE.CHOICE,
              value: typeof next === "string" ? [next] : [],
            })
          }
        >
          <SelectTrigger
            id={id}
            aria-label={label}
            className={cn(
              "w-full data-[size=default]:h-11 sm:w-52 md:data-[size=default]:h-8",
              row.fails && "border-destructive text-destructive",
            )}
          >
            <SelectValue placeholder={tForms("choicePlaceholder")} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {field.options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      );
    }

    if (field.type === FIELD_TYPE.MEASUREMENT) {
      const reading =
        value.type === FIELD_TYPE.MEASUREMENT ? value : EMPTY_READING;
      const limits = limitsFor(field, check.task.resolvedLimits);
      const limitsText = format.limits(limits, field.unit);
      const verdict = measurementVerdict(
        measurementDraftValue(reading),
        limits,
      );
      return (
        <div className="flex items-center gap-2">
          {limitsText ? (
            <LimitChip
              limits={limitsText}
              label={tForms("measurement.allowed", { limits: limitsText })}
              verdict={verdict}
            />
          ) : null}
          <MeasurementInput
            id={id}
            compact
            unit={field.unit}
            symbol={format.symbol(field.unit)}
            draft={reading}
            separator={separator}
            verdict={verdict}
            invalid={invalidShown}
            disabled={disabled}
            ariaLabel={label}
            signLabel={tForms("measurement.signToggle")}
            enterKeyHint={enterKeyHint}
            onKeyDown={(event) => handleEnter(event, check.key)}
            onChange={(next) => set({ type: FIELD_TYPE.MEASUREMENT, ...next })}
          />
        </div>
      );
    }

    const text =
      value.type === FIELD_TYPE.TEXT || value.type === FIELD_TYPE.DATE
        ? value.value
        : "";
    const isDate = field.type === FIELD_TYPE.DATE;
    return (
      <Input
        id={id}
        type={isDate ? "date" : "text"}
        value={text}
        maxLength={isDate ? undefined : TEXT_ANSWER_MAX_LENGTH}
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalidShown}
        enterKeyHint={enterKeyHint}
        className={cn(
          "h-11 md:h-8",
          isDate ? "w-full sm:w-44" : "w-full sm:w-64",
        )}
        onKeyDown={(event) => handleEnter(event, check.key)}
        onChange={(event) =>
          set(
            isDate
              ? { type: FIELD_TYPE.DATE, value: event.target.value }
              : { type: FIELD_TYPE.TEXT, value: event.target.value },
          )
        }
      />
    );
  }

  return (
    <div
      className="flex flex-col gap-5 max-xl:flex-1"
      data-testid="inline-check"
    >
      {areas.map((area) => (
        <section key={area.key} className="flex flex-col gap-2">
          {area.heading ? (
            <h3 className="px-1 text-sm font-semibold">{area.heading}</h3>
          ) : null}
          <ul className="divide-y overflow-hidden rounded-xl ring-1 ring-foreground/10">
            {area.rows.map(({ check, label }) => {
              const row = byKey.get(check.key);
              if (!row) return null;

              return (
                <li
                  key={check.key}
                  className="flex flex-col gap-2.5 px-4 py-2.5"
                  data-testid="inline-row"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="min-w-0 flex-[1_1_10rem]">{label}</span>
                    {control(row, label)}
                  </div>

                  {showIssues && row.issue ? (
                    <p className="text-xs text-destructive">
                      {tForms(`answerValidation.invalid.${field.type}`)}
                    </p>
                  ) : null}

                  {row.fails && row.isReady && asksForAction ? (
                    <div className="flex flex-col gap-2 pb-1">
                      <span className="text-sm font-medium">
                        {correctiveRequired
                          ? t("recordDialog.correctiveTitle")
                          : t("recordDialog.correctiveTitleOptional")}
                      </span>
                      {corrective.answers.length > 0 ? (
                        <CorrectiveAnswers
                          answers={corrective.answers}
                          multiple={corrective.multiple}
                          selected={row.answerIds}
                          disabled={isSaving}
                          onToggle={(answerId) =>
                            draft.toggleAnswer(check.key, answerId)
                          }
                        />
                      ) : null}
                      {noteShown ? (
                        <Input
                          value={row.note}
                          maxLength={NOTES_MAX_LENGTH}
                          disabled={isSaving}
                          aria-label={t("recordDialog.notesLabel")}
                          placeholder={t("inline.notePlaceholder")}
                          onChange={(event) =>
                            draft.setNote(check.key, event.target.value)
                          }
                        />
                      ) : null}
                    </div>
                  ) : null}

                  {row.fails && !row.hasDraft && check.task.correctiveAction ? (
                    <p className="pb-1 text-xs text-muted-foreground">
                      {t("inline.savedAction", {
                        action: check.task.correctiveAction,
                      })}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {showCompleteAll || showDone || hasDrafts ? (
        <div className="flex flex-wrap gap-2 max-xl:sticky max-xl:mt-auto max-xl:bottom-0 max-xl:-mx-4 max-xl:border-t max-xl:bg-popover max-xl:px-4 max-xl:pt-3 max-xl:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {showCompleteAll ? (
            <Button
              variant="outline"
              disabled={isLocked || isSaving}
              className="max-xl:h-12 max-xl:flex-1"
              onClick={draft.completeAll}
              data-testid="inline-complete-all"
            >
              {t("inline.completeAll")}
            </Button>
          ) : null}
          {showDone ? (
            <Button
              disabled={isLocked || missesAction}
              isLoading={isSaving}
              className="max-xl:h-12 max-xl:flex-1"
              onClick={() => void handleDone()}
              data-testid="inline-done"
            >
              <CheckIcon data-icon="inline-start" />
              {t("inline.done")}
            </Button>
          ) : null}
          {hasDrafts ? (
            <Button
              variant="ghost"
              disabled={isSaving}
              className="max-xl:h-12"
              onClick={handleReset}
              data-testid="inline-reset"
            >
              {t("inline.reset")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
