"use client";

import {
  CHOICE_OPTION_LABEL_MAX_LENGTH,
  FORM_FIELD_HELP_MAX_LENGTH,
  FORM_FIELD_LABEL_MAX_LENGTH,
  FIELD_TYPE,
  MEASUREMENT_UNIT_VALUES,
  type MeasurementUnit,
} from "@haccp/shared";
import { PlusIcon, XIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CharacterCount } from "@/components/character-count";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  REQUIRED_LABEL_CLASS,
  Field,
  FieldContent,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  BUILDER_LIMITS,
  mintElementId,
  type BuilderField,
  type FieldIssues,
} from "../../lib/form-builder";
import {
  decimalSeparator,
  formatLimits,
  formatMeasurementNumber,
  parseMeasurementDraft,
  sanitizeMeasurementDraft,
} from "../../lib/measurement";

type Props = {
  idPrefix: string;
  field: BuilderField;
  issues: FieldIssues | undefined;
  onChange: (next: BuilderField) => void;
};

function SwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" className="items-start justify-between">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {description ? <FieldDescription>{description}</FieldDescription> : null}
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  );
}

/** Everything about one field except its position, which the canvas owns. */
export function FieldSettings({ idPrefix, field, issues, onChange }: Props) {
  const t = useTranslations("FormsPage.builder");
  const id = `${idPrefix}-${field.id}`;
  const isCheckbox = field.type === FIELD_TYPE.CHECKBOX;

  return (
    <div className="grid gap-5" data-testid="form-builder-field-settings">
      <Field data-invalid={Boolean(issues?.label)}>
        <FieldLabel htmlFor={`${id}-label`} className={REQUIRED_LABEL_CLASS}>
          {t("labelLabel")}
        </FieldLabel>
        <Input
          id={`${id}-label`}
          value={field.label}
          maxLength={FORM_FIELD_LABEL_MAX_LENGTH}
          aria-invalid={Boolean(issues?.label)}
          placeholder={t(`labelPlaceholder.${field.type}`)}
          onChange={(event) => onChange({ ...field, label: event.target.value })}
        />
        <div className="flex items-start justify-between gap-3">
          {issues?.label ? (
            <FieldError errors={[{ message: t("errors.label") }]} />
          ) : (
            <span />
          )}
          <CharacterCount value={field.label} max={FORM_FIELD_LABEL_MAX_LENGTH} showFrom={0.8} />
        </div>
      </Field>

      <Field>
        <FieldLabel htmlFor={`${id}-help`}>{t("helpLabel")}</FieldLabel>
        <Textarea
          id={`${id}-help`}
          value={field.help ?? ""}
          maxLength={FORM_FIELD_HELP_MAX_LENGTH}
          rows={2}
          className="min-h-16"
          placeholder={t("helpPlaceholder")}
          onChange={(event) => onChange({ ...field, help: event.target.value })}
        />
        <CharacterCount
          value={field.help ?? ""}
          max={FORM_FIELD_HELP_MAX_LENGTH}
          showFrom={0.8}
          className="self-end"
        />
      </Field>

      {field.type === FIELD_TYPE.MEASUREMENT ? (
        <MeasurementSettings
          id={id}
          field={field}
          issues={issues}
          onChange={onChange}
        />
      ) : null}

      {field.type === FIELD_TYPE.CHOICE ? (
        <ChoiceSettings id={id} field={field} issues={issues} onChange={onChange} />
      ) : null}

      {field.type === FIELD_TYPE.TEXT ? (
        <SwitchRow
          id={`${id}-multiline`}
          label={t("multiline")}
          checked={field.multiline}
          onCheckedChange={(multiline) => onChange({ ...field, multiline })}
        />
      ) : null}

      <SwitchRow
        id={`${id}-required`}
        label={isCheckbox ? t("requiredCheckbox") : t("requiredLabel")}
        description={isCheckbox ? t("requiredCheckboxHint") : t("requiredHint")}
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
  const symbol = tForms(`units.${field.unit}.symbol`);
  const min = field.limits.min.trim() ? parseMeasurementDraft(field.limits.min) : null;
  const max = field.limits.max.trim() ? parseMeasurementDraft(field.limits.max) : null;
  const value = (n: number) =>
    `${formatMeasurementNumber(n, field.unit, locale)} ${symbol}`;
  const passes = formatLimits({ min, max }, field.unit, locale, symbol);

  return (
    <div
      className="flex flex-col gap-2 rounded-lg bg-muted p-3"
      data-testid="form-builder-limits-range"
    >
      <div className="flex h-2 gap-0.5" aria-hidden>
        {min !== null ? <span className="flex-1 rounded-full bg-destructive/25" /> : null}
        <span className="flex-[2] rounded-full bg-success" />
        {max !== null ? <span className="flex-1 rounded-full bg-destructive/25" /> : null}
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
}: {
  id: string;
  field: Extract<BuilderField, { type: "measurement" }>;
  issues: FieldIssues | undefined;
  onChange: (next: BuilderField) => void;
}) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const separator = decimalSeparator(useLocale());
  const symbol = tForms(`units.${field.unit}.symbol`);
  const unitItems = MEASUREMENT_UNIT_VALUES.map((unit) => ({
    value: unit,
    label: tForms(`units.${unit}.name`),
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
                [bound]: sanitizeMeasurementDraft(event.target.value, separator, field.unit),
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
        <FieldLabel htmlFor={`${id}-unit`}>{t("unitLabel")}</FieldLabel>
        <Select
          items={unitItems}
          value={field.unit}
          onValueChange={(value: unknown) => {
            const unit = value as MeasurementUnit;
            // Limits typed for the old unit are trimmed to the new one's digits and decimals.
            onChange({
              ...field,
              unit,
              limits: {
                min: sanitizeMeasurementDraft(field.limits.min, separator, unit),
                max: sanitizeMeasurementDraft(field.limits.max, separator, unit),
              },
            });
          }}
        >
          <SelectTrigger id={`${id}-unit`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {unitItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
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
        <p className="text-xs text-muted-foreground">{t("limitsHint")}</p>
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
        <p className="text-xs text-muted-foreground">{t("optionsHint")}</p>
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

      <SwitchRow
        id={`${id}-multiple`}
        label={t("multiple")}
        checked={field.multiple}
        onCheckedChange={(multiple) => onChange({ ...field, multiple })}
      />
    </>
  );
}
