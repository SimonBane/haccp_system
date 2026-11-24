"use client";

import {
  CHOICE_OPTION_LABEL_MAX_LENGTH,
  FORM_FIELD_HELP_MAX_LENGTH,
  FORM_FIELD_LABEL_MAX_LENGTH,
  FIELD_TYPE,
  MEASUREMENT_PARAMETER_VALUES,
  parameterUnit,
  type MeasurementParameter,
} from "@haccp/shared";
import { PlusIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CharacterCount } from "@/components/character-count";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  REQUIRED_LABEL_CLASS,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAnswerFormat } from "../../hooks/use-answer-format";
import {
  BUILDER_LIMITS,
  mintElementId,
  type BuilderField,
  type FieldIssues,
} from "../../lib/form-builder";
import {
  decimalSeparator,
  formatMeasurementNumber,
  parseMeasurementDraft,
  sanitizeMeasurementDraft,
} from "../../lib/measurement";
import { ParameterOption } from "../unit-option";
import { SwitchCard } from "./switch-card";

type Props = {
  idPrefix: string;
  field: BuilderField;
  issues: FieldIssues | undefined;
  onChange: (next: BuilderField) => void;
  /** A published measurement keeps what it measures; the API refuses a version that changes it. */
  parameterLocked?: boolean;
};

/** Everything about one field except its position, which the canvas owns. */
export function FieldSettings({
  idPrefix,
  field,
  issues,
  onChange,
  parameterLocked = false,
}: Props) {
  const t = useTranslations("FormsPage.builder");
  const id = `${idPrefix}-${field.id}`;

  return (
    <div className="grid gap-5" data-testid="form-builder-field-settings">
      <Field data-invalid={Boolean(issues?.label)}>
        <div className="flex items-baseline justify-between gap-3">
          <FieldLabel htmlFor={`${id}-label`} className={REQUIRED_LABEL_CLASS}>
            {t("labelLabel")}
          </FieldLabel>
          <CharacterCount
            value={field.label}
            max={FORM_FIELD_LABEL_MAX_LENGTH}
            showFrom={0.8}
          />
        </div>
        <Input
          id={`${id}-label`}
          value={field.label}
          maxLength={FORM_FIELD_LABEL_MAX_LENGTH}
          aria-invalid={Boolean(issues?.label)}
          placeholder={t(`labelPlaceholder.${field.type}`)}
          onChange={(event) =>
            onChange({ ...field, label: event.target.value })
          }
        />
        {issues?.label ? (
          <FieldError errors={[{ message: t("errors.label") }]} />
        ) : null}
      </Field>

      <Field>
        <div className="flex items-baseline justify-between gap-3">
          <FieldLabel htmlFor={`${id}-help`}>{t("helpLabel")}</FieldLabel>
          <CharacterCount
            value={field.help ?? ""}
            max={FORM_FIELD_HELP_MAX_LENGTH}
            showFrom={0.8}
          />
        </div>
        <Textarea
          id={`${id}-help`}
          value={field.help ?? ""}
          maxLength={FORM_FIELD_HELP_MAX_LENGTH}
          rows={2}
          className="min-h-16"
          placeholder={t("helpPlaceholder")}
          onChange={(event) => onChange({ ...field, help: event.target.value })}
        />
      </Field>

      {field.type === FIELD_TYPE.MEASUREMENT ? (
        <MeasurementSettings
          id={id}
          field={field}
          issues={issues}
          onChange={onChange}
          parameterLocked={parameterLocked}
        />
      ) : null}

      {field.type === FIELD_TYPE.CHOICE ? (
        <ChoiceSettings
          id={id}
          field={field}
          issues={issues}
          onChange={onChange}
        />
      ) : null}

      {field.type === FIELD_TYPE.TEXT ? (
        <SwitchCard
          id={`${id}-multiline`}
          label={t("multiline")}
          description={t("multilineHint")}
          checked={field.multiline}
          onCheckedChange={(multiline) => onChange({ ...field, multiline })}
        />
      ) : null}

      <SwitchCard
        id={`${id}-required`}
        label={t("requiredLabel")}
        description={t("requiredHint")}
        checked={field.required}
        onCheckedChange={(required) => onChange({ ...field, required })}
      />
    </div>
  );
}

function LimitsRange({
  field,
}: {
  field: Extract<BuilderField, { type: "measurement" }>;
}) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const locale = useLocale();
  const format = useAnswerFormat();
  const symbol = tForms(`units.${field.unit}.symbol`);
  const min = field.limits.min.trim()
    ? parseMeasurementDraft(field.limits.min)
    : null;
  const max = field.limits.max.trim()
    ? parseMeasurementDraft(field.limits.max)
    : null;
  const value = (n: number) =>
    `${formatMeasurementNumber(n, field.unit, locale)} ${symbol}`;
  const passes = format.limits({ min, max }, field.unit);

  return (
    <div
      className="flex flex-col gap-2 rounded-lg bg-muted p-3"
      data-testid="form-builder-limits-range"
    >
      <div className="flex h-2 gap-0.5" aria-hidden>
        {min !== null ? (
          <span className="flex-1 rounded-full bg-destructive/25" />
        ) : null}
        <span className="flex-[2] rounded-full bg-success" />
        {max !== null ? (
          <span className="flex-1 rounded-full bg-destructive/25" />
        ) : null}
      </div>
      <div className="flex justify-between gap-2 text-xs tabular-nums">
        {min !== null ? (
          <span className="text-destructive">
            {t("failsBelow", { value: value(min) })}
          </span>
        ) : null}
        <span className="flex-1 text-center font-medium text-success">
          {passes ? t("passes", { limits: passes }) : t("passesAlways")}
        </span>
        {max !== null ? (
          <span className="text-destructive">
            {t("failsAbove", { value: value(max) })}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MeasurementSettings({
  id,
  field,
  issues,
  onChange,
  parameterLocked,
}: {
  id: string;
  field: Extract<BuilderField, { type: "measurement" }>;
  issues: FieldIssues | undefined;
  onChange: (next: BuilderField) => void;
  parameterLocked: boolean;
}) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const separator = decimalSeparator(useLocale());
  const symbol = tForms(`units.${field.unit}.symbol`);
  const parameterItems = MEASUREMENT_PARAMETER_VALUES.map((parameter) => ({
    value: parameter,
    label: tForms(`parameters.${parameter}`),
  }));
  const limitsError = issues?.limits
    ? t(`errors.limits.${issues.limits}`)
    : null;

  const limitInput = (bound: "min" | "max") => (
    <Field className="gap-1.5">
      <FieldLabel
        htmlFor={`${id}-${bound}`}
        className="text-xs font-normal text-muted-foreground"
      >
        {t(bound === "min" ? "limitMin" : "limitMax")}
      </FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={`${id}-${bound}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={issues?.limits === bound || issues?.limits === "order"}
          placeholder={t("noLimit")}
          className="tabular-nums"
          value={field.limits[bound]}
          onChange={(event) =>
            onChange({
              ...field,
              limits: {
                ...field.limits,
                [bound]: sanitizeMeasurementDraft(
                  event.target.value,
                  separator,
                  field.unit,
                ),
              },
            })
          }
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{symbol}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-parameter`}>
          {t("parameterLabel")}
        </FieldLabel>
        <Select
          items={parameterItems}
          value={field.parameter}
          disabled={parameterLocked}
          onValueChange={(value: unknown) => {
            const parameter = value as MeasurementParameter;
            const unit = parameterUnit(parameter);
            // Limits typed for the old unit are trimmed to the new one's digits and decimals.
            onChange({
              ...field,
              parameter,
              unit,
              limits: {
                min: sanitizeMeasurementDraft(
                  field.limits.min,
                  separator,
                  unit,
                ),
                max: sanitizeMeasurementDraft(
                  field.limits.max,
                  separator,
                  unit,
                ),
              },
            });
          }}
        >
          <SelectTrigger id={`${id}-parameter`} className="w-full">
            <SelectValue>
              {(value: MeasurementParameter) => (
                <ParameterOption parameter={value} />
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {parameterItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  <ParameterOption parameter={item.value} />
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {parameterLocked ? (
          <FieldDescription>{t("parameterLocked")}</FieldDescription>
        ) : null}
      </Field>

      <FieldSet className="gap-2.5" data-invalid={Boolean(limitsError)}>
        <FieldLegend variant="label">{t("limitsLabel")}</FieldLegend>
        <div className="grid grid-cols-2 gap-2.5">
          {limitInput("min")}
          {limitInput("max")}
        </div>
        {limitsError ? (
          <FieldError errors={[{ message: limitsError }]} />
        ) : (
          <LimitsRange field={field} />
        )}
      </FieldSet>
    </>
  );
}

function ChoiceSettings({
  id,
  field,
  issues,
  onChange,
}: {
  id: string;
  field: Extract<BuilderField, { type: "choice" }>;
  issues: FieldIssues | undefined;
  onChange: (next: BuilderField) => void;
}) {
  const t = useTranslations("FormsPage.builder");
  const blankOptions = new Set(issues?.optionLabels ?? []);
  const canRemove = field.options.length > BUILDER_LIMITS.minOptions;
  const canAdd = field.options.length < BUILDER_LIMITS.maxOptions;
  const failing = field.options.filter((option) => option.fails).length;

  function updateOption(
    optionIndex: number,
    patch: Partial<(typeof field.options)[number]>,
  ) {
    onChange({
      ...field,
      options: field.options.map((option, index) =>
        index === optionIndex ? { ...option, ...patch } : option,
      ),
    });
  }

  return (
    <>
      <FieldSet className="gap-2" data-invalid={blankOptions.size > 0}>
        <FieldLegend variant="label">{t("optionsLabel")}</FieldLegend>
        <ul className="flex flex-col gap-2">
          {field.options.map((option, optionIndex) => {
            const optionId = `${id}-option-${option.id}`;
            return (
              <li key={option.id} className="flex items-center gap-2">
                <Input
                  id={optionId}
                  value={option.label}
                  maxLength={CHOICE_OPTION_LABEL_MAX_LENGTH}
                  aria-label={t("optionLabel", { index: optionIndex + 1 })}
                  aria-invalid={blankOptions.has(optionIndex)}
                  className="flex-1"
                  onChange={(event) =>
                    updateOption(optionIndex, { label: event.target.value })
                  }
                />
                <CharacterCount
                  value={option.label}
                  max={CHOICE_OPTION_LABEL_MAX_LENGTH}
                  showFrom={0.8}
                />
                <FieldLabel
                  htmlFor={`${optionId}-fails`}
                  className={cn(
                    "shrink-0 items-center gap-1.5 font-normal",
                    option.fails && "text-destructive",
                  )}
                >
                  <Checkbox
                    id={`${optionId}-fails`}
                    checked={option.fails}
                    onCheckedChange={(fails) =>
                      updateOption(optionIndex, { fails: fails === true })
                    }
                  />
                  {t("optionFails")}
                </FieldLabel>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("removeOption", { index: optionIndex + 1 })}
                  disabled={!canRemove}
                  onClick={() =>
                    onChange({
                      ...field,
                      options: field.options.filter(
                        (_, index) => index !== optionIndex,
                      ),
                    })
                  }
                >
                  <XIcon />
                </Button>
              </li>
            );
          })}
        </ul>
        {blankOptions.size > 0 ? (
          <FieldError errors={[{ message: t("errors.optionLabel") }]} />
        ) : null}
        <div className="flex items-center justify-between gap-2">
          {canAdd ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange({
                  ...field,
                  options: [
                    ...field.options,
                    {
                      id: mintElementId(
                        "o",
                        new Set(field.options.map((option) => option.id)),
                      ),
                      label: "",
                      fails: false,
                    },
                  ],
                })
              }
            >
              <PlusIcon data-icon="inline-start" />
              {t("addOption")}
            </Button>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("failingOptions", { failing, total: field.options.length })}
          </span>
        </div>
      </FieldSet>

      <SwitchCard
        id={`${id}-multiple`}
        label={t("multiple")}
        description={t("multipleHint")}
        checked={field.multiple}
        onCheckedChange={(multiple) => onChange({ ...field, multiple })}
      />
    </>
  );
}
