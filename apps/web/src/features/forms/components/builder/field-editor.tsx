"use client";

import {
  FIELD_TYPE,
  MEASUREMENT_UNIT_VALUES,
  type MeasurementUnit,
} from "@haccp/shared";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  REQUIRED_LABEL_CLASS,
  Field,
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
import { cn } from "@/lib/utils";
import { FIELD_TYPE_ICONS } from "../../lib/category-icon";
import {
  BUILDER_LIMITS,
  mintElementId,
  type BuilderField,
  type FieldIssues,
} from "../../lib/form-builder";

type Props = {
  idPrefix: string;
  field: BuilderField;
  index: number;
  count: number;
  issues: FieldIssues | undefined;
  expanded: boolean;
  onToggle: () => void;
  onChange: (next: BuilderField) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
};

function sanitizeLimitText(raw: string): string {
  return raw.replace(/[−–—]/g, "-").replace(/[^0-9\-.,]/g, "");
}

function SwitchRow({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Field orientation="horizontal">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <FieldLabel htmlFor={id} className="font-normal">
        {label}
      </FieldLabel>
    </Field>
  );
}

export function FieldEditor({
  idPrefix,
  field,
  index,
  count,
  issues,
  expanded,
  onToggle,
  onChange,
  onMove,
  onRemove,
}: Props) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const id = `${idPrefix}-${field.id}`;
  const TypeIcon = FIELD_TYPE_ICONS[field.type];
  const hasIssues = Boolean(issues);
  const typeLabel = tForms(`fieldTypes.${field.type}`);
  const title = field.label.trim() || t("untitled");

  return (
    <Card
      className={cn("gap-0 p-0", hasIssues && "ring-destructive/40")}
      data-testid="form-builder-field"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Button
          type="button"
          variant="ghost"
          className="h-auto min-w-0 flex-1 justify-start gap-2.5 px-1 py-1.5 text-left"
          aria-expanded={expanded}
          aria-controls={`${id}-settings`}
          onClick={onToggle}
        >
          <TypeIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="flex min-w-0 flex-col">
            <span
              className={cn(
                "truncate text-sm font-medium",
                !field.label.trim() && "text-muted-foreground",
              )}
            >
              {title}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {field.required ? `${typeLabel} · ${t("required")}` : typeLabel}
            </span>
          </span>
          {hasIssues ? (
            <CircleAlertIcon
              className="size-4 shrink-0 text-destructive"
              aria-label={t("needsAttention")}
            />
          ) : null}
          <ChevronDownIcon
            className={cn(
              "ml-auto size-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("moveUp", { label: title })}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("moveDown", { label: title })}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDownIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("removeField", { label: title })}
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>

      {expanded ? (
        <div id={`${id}-settings`} className="grid gap-4 border-t px-4 py-4">
          <Field data-invalid={Boolean(issues?.label)}>
            <FieldLabel
              htmlFor={`${id}-label`}
              className={REQUIRED_LABEL_CLASS}
            >
              {t("labelLabel")}
            </FieldLabel>
            <Input
              id={`${id}-label`}
              value={field.label}
              maxLength={200}
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
            <FieldLabel htmlFor={`${id}-help`}>{t("helpLabel")}</FieldLabel>
            <Input
              id={`${id}-help`}
              value={field.help ?? ""}
              maxLength={500}
              placeholder={t("helpPlaceholder")}
              onChange={(event) =>
                onChange({ ...field, help: event.target.value })
              }
            />
          </Field>

          <SwitchRow
            id={`${id}-required`}
            label={
              field.type === FIELD_TYPE.CHECKBOX
                ? t("requiredCheckbox")
                : t("requiredLabel")
            }
            checked={field.required}
            onCheckedChange={(required) => onChange({ ...field, required })}
          />

          {field.type === FIELD_TYPE.MEASUREMENT ? (
            <MeasurementSettings
              id={id}
              field={field}
              issues={issues}
              onChange={onChange}
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
            <SwitchRow
              id={`${id}-multiline`}
              label={t("multiline")}
              checked={field.multiline}
              onCheckedChange={(multiline) => onChange({ ...field, multiline })}
            />
          ) : null}
        </div>
      ) : null}
    </Card>
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
  const symbol = tForms(`units.${field.unit}.symbol`);
  const unitItems = MEASUREMENT_UNIT_VALUES.map((unit) => ({
    value: unit,
    label: tForms(`units.${unit}.name`),
  }));
  const limitsError = issues?.limits
    ? t(`errors.limits.${issues.limits}`)
    : null;

  const limitInput = (bound: "min" | "max") => (
    <InputGroup className="flex-1">
      <InputGroupInput
        id={`${id}-${bound}`}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={t(bound === "min" ? "limitMin" : "limitMax")}
        aria-invalid={issues?.limits === bound || issues?.limits === "order"}
        placeholder={t("noLimit")}
        className="tabular-nums"
        value={field.limits[bound]}
        onChange={(event) =>
          onChange({
            ...field,
            limits: {
              ...field.limits,
              [bound]: sanitizeLimitText(event.target.value),
            },
          })
        }
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{symbol}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );

  return (
    <>
      <Field>
        <FieldLabel htmlFor={`${id}-unit`}>{t("unitLabel")}</FieldLabel>
        <Select
          items={unitItems}
          value={field.unit}
          onValueChange={(value: unknown) =>
            onChange({ ...field, unit: value as MeasurementUnit })
          }
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

      <FieldSet className="gap-2" data-invalid={Boolean(limitsError)}>
        <FieldLegend variant="label">{t("limitsLabel")}</FieldLegend>
        <div className="flex items-center gap-2">
          {limitInput("min")}
          <span className="shrink-0 text-sm text-muted-foreground">
            {t("limitsTo")}
          </span>
          {limitInput("max")}
        </div>
        {limitsError ? (
          <FieldError errors={[{ message: limitsError }]} />
        ) : (
          <p className="text-xs text-muted-foreground">{t("limitsHint")}</p>
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
      <SwitchRow
        id={`${id}-multiple`}
        label={t("multiple")}
        checked={field.multiple}
        onCheckedChange={(multiple) => onChange({ ...field, multiple })}
      />

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
                  maxLength={200}
                  aria-label={t("optionLabel", { index: optionIndex + 1 })}
                  aria-invalid={blankOptions.has(optionIndex)}
                  className="flex-1"
                  onChange={(event) =>
                    updateOption(optionIndex, { label: event.target.value })
                  }
                />
                <FieldLabel
                  htmlFor={`${optionId}-fails`}
                  className="shrink-0 items-center gap-1.5 font-normal"
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
        {canAdd ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
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
        ) : null}
      </FieldSet>
    </>
  );
}
