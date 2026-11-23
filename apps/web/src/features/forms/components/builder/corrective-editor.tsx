"use client";

import {
  CORRECTIVE_ACTION_MODE,
  CORRECTIVE_ANSWER_LABEL_MAX_LENGTH,
  type CorrectiveActionMode,
  type CorrectiveSettings,
  type FormCategory,
} from "@haccp/shared";
import { PlusIcon, WrenchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { CharacterCount } from "@/components/character-count";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  correctiveSuggestionsFor,
  unusedSuggestions,
} from "../../lib/corrective-suggestions";
import {
  addCorrectiveAnswer,
  BUILDER_LIMITS,
  correctiveNoteShown,
} from "../../lib/form-builder";
import { SwitchCard } from "./switch-card";

type Props = {
  idPrefix: string;
  category: FormCategory | "";
  corrective: CorrectiveSettings;
  mode: CorrectiveActionMode;
  /** Indexes of answers with an empty label, once issues are shown. */
  blankAnswers: readonly number[] | undefined;
  /** In a sheet titled "Corrective actions" the switch row drops the repeated heading. */
  inSheet?: boolean;
  onChange: (next: CorrectiveSettings) => void;
  onModeChange: (mode: CorrectiveActionMode) => void;
};

/** Whether staff are asked for a corrective action on a failed check, and the form's own answers for it. */
export function CorrectiveEditor({
  idPrefix,
  category,
  corrective,
  mode,
  blankAnswers,
  inSheet = false,
  onChange,
  onModeChange,
}: Props) {
  const t = useTranslations("FormsPage.builder");
  const id = `${idPrefix}-corrective`;
  const on = mode !== CORRECTIVE_ACTION_MODE.OFF;
  const blank = new Set(blankAnswers ?? []);
  const canAdd =
    corrective.answers.length < BUILDER_LIMITS.maxCorrectiveAnswers;
  const suggestions = canAdd
    ? unusedSuggestions(
        correctiveSuggestionsFor(category).map((key) => ({
          key,
          label: t(`corrective.suggestions.${key}`),
        })),
        corrective.answers.map((answer) => answer.label),
      )
    : [];

  return (
    <div className="flex flex-col gap-5" data-testid="form-builder-corrective">
      <Field orientation="horizontal" className="items-center justify-between">
        {inSheet ? null : (
          <span className="grid size-9 shrink-0 place-items-center self-center rounded-lg bg-primary/10 text-primary">
            <WrenchIcon className="size-4" aria-hidden />
          </span>
        )}
        <FieldContent>
          <FieldLabel htmlFor={`${id}-on`}>
            {inSheet ? t("corrective.subheading") : t("corrective.heading")}
          </FieldLabel>
          <FieldDescription>
            {inSheet
              ? on
                ? t("corrective.onDescription")
                : t("corrective.offDescription")
              : t("corrective.subheading")}
          </FieldDescription>
        </FieldContent>
        <Switch
          id={`${id}-on`}
          className="self-center"
          checked={on}
          onCheckedChange={(checked) =>
            onModeChange(
              checked
                ? CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL
                : CORRECTIVE_ACTION_MODE.OFF,
            )
          }
        />
      </Field>

      {on ? (
        <>
          <div
            role="group"
            aria-labelledby={`${id}-answers`}
            className="flex flex-col gap-2"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span id={`${id}-answers`} className="text-sm font-medium">
                {t("corrective.answersLabel")}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("corrective.answersCount", {
                  count: corrective.answers.length,
                  max: BUILDER_LIMITS.maxCorrectiveAnswers,
                })}
              </span>
            </div>

            {corrective.answers.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {corrective.answers.map((answer, index) => (
                  <li key={answer.id} className="flex items-center gap-2">
                    <Input
                      id={`${id}-answer-${answer.id}`}
                      value={answer.label}
                      maxLength={CORRECTIVE_ANSWER_LABEL_MAX_LENGTH}
                      placeholder={t("corrective.answerPlaceholder")}
                      aria-label={t("corrective.answerLabel", {
                        index: index + 1,
                      })}
                      aria-invalid={blank.has(index)}
                      className="flex-1"
                      onChange={(event) =>
                        onChange({
                          ...corrective,
                          answers: corrective.answers.map((item) =>
                            item.id === answer.id
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                    <CharacterCount
                      value={answer.label}
                      max={CORRECTIVE_ANSWER_LABEL_MAX_LENGTH}
                      showFrom={0.8}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t("corrective.removeAnswer", {
                        index: index + 1,
                      })}
                      onClick={() =>
                        onChange({
                          ...corrective,
                          answers: corrective.answers.filter(
                            (item) => item.id !== answer.id,
                          ),
                        })
                      }
                    >
                      <XIcon />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed px-4 py-3.5 text-sm text-muted-foreground">
                {t("corrective.empty")}
              </p>
            )}

            {blank.size > 0 ? (
              <FieldError
                errors={[{ message: t("corrective.answerLabelError") }]}
              />
            ) : null}

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canAdd}
                onClick={() => onChange(addCorrectiveAnswer(corrective, ""))}
              >
                <PlusIcon data-icon="inline-start" />
                {t("corrective.addAnswer")}
              </Button>
            </div>
          </div>

          {suggestions.length > 0 ? (
            <div className="flex flex-col gap-2.5">
              <span className="text-xs text-muted-foreground">
                {t("corrective.suggestionsLabel")}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((suggestion) => (
                  <Button
                    key={suggestion.key}
                    type="button"
                    variant="secondary"
                    size="xs"
                    className="rounded-full max-md:h-11 max-md:px-3.5"
                    onClick={() =>
                      onChange(
                        addCorrectiveAnswer(corrective, suggestion.label),
                      )
                    }
                  >
                    <PlusIcon data-icon="inline-start" />
                    {suggestion.label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <SwitchCard
              id={`${id}-multiple`}
              label={t("multiple")}
              description={t("corrective.multipleHint")}
              checked={corrective.multiple}
              onCheckedChange={(multiple) =>
                onChange({ ...corrective, multiple })
              }
            />
            <SwitchCard
              id={`${id}-note`}
              label={t("corrective.allowNote")}
              description={t("corrective.allowNoteHint")}
              checked={correctiveNoteShown(corrective)}
              disabled={corrective.answers.length === 0}
              onCheckedChange={(allowNote) =>
                onChange({ ...corrective, allowNote })
              }
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
