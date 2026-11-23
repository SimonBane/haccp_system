"use client";

import {
  FORM_APPLIES_TO,
  FORM_APPLIES_TO_VALUES,
  FORM_CATEGORY_VALUES,
  FORM_NAME_MAX_LENGTH,
  type FormAppliesTo,
  type FormCategory,
} from "@haccp/shared";
import { BuildingIcon, LayersIcon, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { CharacterCount } from "@/components/character-count";
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
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { FORM_CATEGORY_ICONS } from "../../lib/category-icon";
import type { BuilderIssues, BuilderState } from "../../lib/form-builder";
import { SwitchCard } from "./switch-card";

const APPLIES_TO_ICONS: Record<FormAppliesTo, LucideIcon> = {
  [FORM_APPLIES_TO.PER_ITEM]: LayersIcon,
  [FORM_APPLIES_TO.LOCATION]: BuildingIcon,
};

type Props = {
  idPrefix: string;
  state: BuilderState;
  issues: BuilderIssues | null;
  nameTaken: boolean;
  /** A blank form opens here with the cursor in the name. */
  autoFocusName: boolean;
  onPatch: (patch: Partial<BuilderState>) => void;
};

/** The form's own details: name, category, what it is filled in for, and whether staff can log it any time. */
export function FormSettingsFields({
  idPrefix,
  state,
  issues,
  nameTaken,
  autoFocusName,
  onPatch,
}: Props) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const nameInvalid = Boolean(issues?.name) || nameTaken;
  const categoryItems = FORM_CATEGORY_VALUES.map((category) => ({
    value: category,
    label: tForms(`categories.${category}`),
  }));

  return (
    <div className="flex flex-col gap-6">
      <Field data-invalid={nameInvalid}>
        <div className="flex items-baseline justify-between gap-3">
          <FieldLabel
            htmlFor={`${idPrefix}-name`}
            className={REQUIRED_LABEL_CLASS}
          >
            {t("nameLabel")}
          </FieldLabel>
          <CharacterCount value={state.name} max={FORM_NAME_MAX_LENGTH} />
        </div>
        <Input
          id={`${idPrefix}-name`}
          value={state.name}
          maxLength={FORM_NAME_MAX_LENGTH}
          placeholder={t("namePlaceholder")}
          aria-invalid={nameInvalid}
          autoFocus={autoFocusName}
          onChange={(event) => onPatch({ name: event.target.value })}
        />
        {issues?.name ? (
          <FieldError errors={[{ message: t("errors.name") }]} />
        ) : nameTaken ? (
          <FieldError errors={[{ message: t("errors.nameTaken") }]} />
        ) : (
          <FieldDescription>{t("nameHint")}</FieldDescription>
        )}
      </Field>

      <Field data-invalid={Boolean(issues?.category)}>
        <FieldLabel
          htmlFor={`${idPrefix}-category`}
          className={REQUIRED_LABEL_CLASS}
        >
          {t("categoryLabel")}
        </FieldLabel>
        <Select
          items={categoryItems}
          value={state.category || null}
          onValueChange={(value) => {
            if (value) onPatch({ category: value as FormCategory });
          }}
        >
          <SelectTrigger
            id={`${idPrefix}-category`}
            aria-invalid={Boolean(issues?.category)}
            className="w-full"
          >
            <SelectValue>
              {(value: FormCategory | null) => {
                if (!value) return t("categoryPlaceholder");
                const Icon = FORM_CATEGORY_ICONS[value];
                return (
                  <span className="flex items-center gap-2">
                    <Icon className="size-4" aria-hidden />
                    {tForms(`categories.${value}`)}
                  </span>
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {categoryItems.map((item) => {
                const Icon = FORM_CATEGORY_ICONS[item.value];
                return (
                  <SelectItem key={item.value} value={item.value}>
                    <Icon aria-hidden />
                    {item.label}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
        {issues?.category ? (
          <FieldError errors={[{ message: t("errors.category") }]} />
        ) : null}
      </Field>

      <FieldSet data-invalid={Boolean(issues?.appliesTo)}>
        <FieldLegend variant="label" className={REQUIRED_LABEL_CLASS}>
          {t("appliesToLabel")}
        </FieldLegend>
        <ToggleGroup
          aria-label={t("appliesToLabel")}
          value={state.appliesTo ? [state.appliesTo] : []}
          onValueChange={(next) => {
            const value = next[0] as FormAppliesTo | undefined;
            if (value) onPatch({ appliesTo: value });
          }}
          className="grid w-full gap-2"
        >
          {FORM_APPLIES_TO_VALUES.map((value) => {
            const Icon = APPLIES_TO_ICONS[value];
            return (
              <ToggleGroupItem
                key={value}
                value={value}
                className={cn(
                  "group/card h-auto w-full items-start justify-start gap-3 rounded-xl border border-input p-3.5 text-left font-normal whitespace-normal",
                  "aria-pressed:border-primary aria-pressed:bg-primary/[0.04] aria-pressed:ring-1 aria-pressed:ring-primary",
                )}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted group-aria-pressed/card:bg-primary group-aria-pressed/card:text-primary-foreground">
                  <Icon aria-hidden />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {tForms(`appliesTo.${value}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {tForms(`appliesToHints.${value}`)}
                  </span>
                </span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
        {issues?.appliesTo ? (
          <FieldError errors={[{ message: t("errors.appliesTo") }]} />
        ) : null}
      </FieldSet>

      <SwitchCard
        id={`${idPrefix}-on-demand`}
        label={t("onDemandLabel")}
        description={t("onDemandHint")}
        checked={state.onDemand}
        onCheckedChange={(onDemand) => onPatch({ onDemand })}
      />
    </div>
  );
}
