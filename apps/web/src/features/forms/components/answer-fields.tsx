"use client";

import {
  FIELD_TYPE,
  TEXT_ANSWER_MAX_LENGTH,
  type ChoiceField,
  type FormDefinition,
  type FormField,
  type MeasurementField,
  type ResolvedLimits,
} from "@haccp/shared";
import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  REQUIRED_LABEL_CLASS,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { useAnswerFormat } from "../hooks/use-answer-format";
import {
  limitsFor,
  measurementDraftValue,
  type AnswerDraft,
  type DraftIssue,
  type FieldDraft,
} from "../lib/answer-draft";
import { measurementVerdict } from "../lib/measurement";
import { MeasurementInput } from "./measurement-input";

/** Above this a row of toggles wraps badly on a phone, so a single choice becomes a select. */
const CHOICE_TOGGLE_MAX_OPTIONS = 5;

type AnswerFieldsProps = {
  idPrefix: string;
  definition: FormDefinition;
  limits: ResolvedLimits;
  draft: AnswerDraft;
  issues: Record<string, DraftIssue>;
  separator: string;
  onChange: (fieldId: string, next: FieldDraft) => void;
};

export function AnswerFields({
  idPrefix,
  definition,
  limits,
  draft,
  issues,
  separator,
  onChange,
}: AnswerFieldsProps) {
  return (
    <div className="flex flex-col gap-5">
      {definition.fields.map((field) => (
        <AnswerField
          key={field.id}
          id={`${idPrefix}-${field.id}`}
          field={field}
          limits={limits}
          entry={draft[field.id]}
          issue={issues[field.id] ?? null}
          separator={separator}
          onChange={(next) => onChange(field.id, next)}
        />
      ))}
    </div>
  );
}

type AnswerFieldProps = {
  id: string;
  field: FormField;
  limits: ResolvedLimits;
  entry: FieldDraft | undefined;
  issue: DraftIssue | null;
  separator: string;
  onChange: (next: FieldDraft) => void;
};

function AnswerField({
  id,
  field,
  limits,
  entry,
  issue,
  separator,
  onChange,
}: AnswerFieldProps) {
  const t = useTranslations("Forms");
  const errorMessage = issue
    ? issue === "required"
      ? t("answerValidation.required")
      : t(`answerValidation.invalid.${field.type}`)
    : null;
  const help = field.help ? (
    <FieldDescription>{field.help}</FieldDescription>
  ) : null;
  const error = errorMessage ? (
    <FieldError errors={[{ message: errorMessage }]} />
  ) : null;

  if (field.type === FIELD_TYPE.CHECKBOX) {
    const checked = entry?.type === FIELD_TYPE.CHECKBOX && entry.value;
    return (
      <Field data-invalid={Boolean(issue)}>
        <FieldLabel
          htmlFor={id}
          className="w-full items-center gap-3 rounded-lg border px-3 py-3"
        >
          <Checkbox
            id={id}
            checked={checked}
            aria-invalid={Boolean(issue)}
            onCheckedChange={(next) =>
              onChange({ type: FIELD_TYPE.CHECKBOX, value: next === true })
            }
          />
          <span
            className={cn("flex-1", field.required && REQUIRED_LABEL_CLASS)}
          >
            {field.label}
          </span>
        </FieldLabel>
        {help}
        {error}
      </Field>
    );
  }

  if (field.type === FIELD_TYPE.MEASUREMENT) {
    return (
      <MeasurementAnswer
        id={id}
        field={field}
        limits={limits}
        entry={entry}
        invalid={Boolean(issue)}
        separator={separator}
        onChange={onChange}
        help={help}
        error={error}
      />
    );
  }

  if (field.type === FIELD_TYPE.CHOICE) {
    return (
      <ChoiceAnswer
        id={id}
        field={field}
        selected={entry?.type === FIELD_TYPE.CHOICE ? entry.value : []}
        invalid={Boolean(issue)}
        onChange={(value) => onChange({ type: FIELD_TYPE.CHOICE, value })}
        help={help}
        error={error}
      />
    );
  }

  const value =
    entry?.type === FIELD_TYPE.TEXT || entry?.type === FIELD_TYPE.DATE
      ? entry.value
      : "";

  return (
    <Field data-invalid={Boolean(issue)}>
      <FieldLabel
        htmlFor={id}
        className={field.required ? REQUIRED_LABEL_CLASS : undefined}
      >
        {field.label}
      </FieldLabel>
      {field.type === FIELD_TYPE.TEXT && field.multiline ? (
        <Textarea
          id={id}
          value={value}
          maxLength={TEXT_ANSWER_MAX_LENGTH}
          aria-invalid={Boolean(issue)}
          className="min-h-20"
          onChange={(event) =>
            onChange({ type: FIELD_TYPE.TEXT, value: event.target.value })
          }
        />
      ) : field.type === FIELD_TYPE.TEXT ? (
        <Input
          id={id}
          value={value}
          maxLength={TEXT_ANSWER_MAX_LENGTH}
          aria-invalid={Boolean(issue)}
          onChange={(event) =>
            onChange({ type: FIELD_TYPE.TEXT, value: event.target.value })
          }
        />
      ) : (
        <Input
          id={id}
          type="date"
          value={value}
          aria-invalid={Boolean(issue)}
          onChange={(event) =>
            onChange({ type: FIELD_TYPE.DATE, value: event.target.value })
          }
        />
      )}
      {help}
      {error}
    </Field>
  );
}

function MeasurementAnswer({
  id,
  field,
  limits,
  entry,
  invalid,
  separator,
  onChange,
  help,
  error,
}: {
  id: string;
  field: MeasurementField;
  limits: ResolvedLimits;
  entry: FieldDraft | undefined;
  invalid: boolean;
  separator: string;
  onChange: (next: FieldDraft) => void;
  help: ReactNode;
  error: ReactNode;
}) {
  const t = useTranslations("Forms");
  const format = useAnswerFormat();
  const draft =
    entry?.type === FIELD_TYPE.MEASUREMENT
      ? entry
      : { type: FIELD_TYPE.MEASUREMENT, sign: 1 as const, digits: "" };
  const fieldLimits = limitsFor(field, limits);
  const verdict = measurementVerdict(measurementDraftValue(draft), fieldLimits);
  const limitsText = format.limits(fieldLimits, field.unit);
  const statusId = `${id}-status`;

  return (
    <Field data-invalid={invalid}>
      <FieldLabel
        htmlFor={id}
        className={field.required ? REQUIRED_LABEL_CLASS : undefined}
      >
        {field.label}
      </FieldLabel>
      <MeasurementInput
        id={id}
        unit={field.unit}
        symbol={format.symbol(field.unit)}
        draft={draft}
        separator={separator}
        invalid={invalid}
        describedById={statusId}
        signLabel={t("measurement.signToggle")}
        onChange={(next) => onChange({ type: FIELD_TYPE.MEASUREMENT, ...next })}
      />
      <div
        id={statusId}
        aria-live="polite"
        className="flex min-h-5 flex-wrap items-center gap-2 text-xs text-muted-foreground"
      >
        {verdict ? (
          <Badge variant={verdict === "pass" ? "success" : "destructive"}>
            {verdict === "pass" ? <CheckIcon /> : <CircleAlertIcon />}
            {verdict === "pass"
              ? t("measurement.withinLimits")
              : t("measurement.outsideLimits")}
          </Badge>
        ) : null}
        {limitsText ? (
          <span>{t("measurement.allowed", { limits: limitsText })}</span>
        ) : null}
      </div>
      {help}
      {error}
    </Field>
  );
}

function ChoiceAnswer({
  id,
  field,
  selected,
  invalid,
  onChange,
  help,
  error,
}: {
  id: string;
  field: ChoiceField;
  selected: string[];
  invalid: boolean;
  onChange: (value: string[]) => void;
  help: ReactNode;
  error: ReactNode;
}) {
  const t = useTranslations("Forms");
  const labelClass = field.required ? REQUIRED_LABEL_CLASS : undefined;

  if (field.multiple) {
    return (
      <Field data-invalid={invalid}>
        <FieldTitle className={labelClass}>{field.label}</FieldTitle>
        <div className="flex flex-col gap-2">
          {field.options.map((option) => {
            const optionId = `${id}-${option.id}`;
            const checked = selected.includes(option.id);
            return (
              <FieldLabel
                key={option.id}
                htmlFor={optionId}
                className="w-full items-center gap-3 rounded-lg border px-3 py-2.5"
              >
                <Checkbox
                  id={optionId}
                  checked={checked}
                  aria-invalid={invalid}
                  onCheckedChange={(next) =>
                    onChange(
                      next
                        ? [...selected, option.id]
                        : selected.filter((value) => value !== option.id),
                    )
                  }
                />
                <span className="flex-1">{option.label}</span>
              </FieldLabel>
            );
          })}
        </div>
        {help}
        {error}
      </Field>
    );
  }

  if (field.options.length > CHOICE_TOGGLE_MAX_OPTIONS) {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={id} className={labelClass}>
          {field.label}
        </FieldLabel>
        <Select
          items={field.options.map((option) => ({
            label: option.label,
            value: option.id,
          }))}
          value={selected[0] ?? null}
          onValueChange={(value: unknown) =>
            onChange(typeof value === "string" ? [value] : [])
          }
        >
          <SelectTrigger id={id} aria-invalid={invalid} className="w-full">
            <SelectValue placeholder={t("choicePlaceholder")} />
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
        {help}
        {error}
      </Field>
    );
  }

  return (
    <Field data-invalid={invalid}>
      <FieldTitle id={`${id}-label`} className={labelClass}>
        {field.label}
      </FieldTitle>
      <ToggleGroup
        aria-labelledby={`${id}-label`}
        aria-invalid={invalid}
        value={selected.slice(0, 1)}
        onValueChange={(next) => onChange(next.slice(-1))}
        variant="outline"
        spacing={2}
        className="flex w-full flex-wrap"
      >
        {field.options.map((option) => (
          <ToggleGroupItem
            key={option.id}
            value={option.id}
            className="h-(--control-h) min-w-20 flex-1 cursor-pointer aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {help}
      {error}
    </Field>
  );
}
