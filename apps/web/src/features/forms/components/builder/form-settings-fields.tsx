"use client";

import {
  FORM_NAME_MAX_LENGTH,
  CORRECTIVE_ACTION_MODE,
  FORM_APPLIES_TO_VALUES,
  FORM_CATEGORY_VALUES,
  type FormAppliesTo,
  type FormCategory,
} from "@haccp/shared";
import { InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { CharacterCount } from "@/components/character-count";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  REQUIRED_LABEL_CLASS,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
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
import { Switch } from "@/components/ui/switch";
import type { BuilderIssues, BuilderState } from "../../lib/form-builder";
import { FORM_CATEGORY_ICONS } from "../../lib/category-icon";

type Props = {
  idPrefix: string;
  state: BuilderState;
  issues: BuilderIssues | null;
  nameTaken: boolean;
  /** Null for a form that has never been published. */
  publishedVersion: number | null;
  onPatch: (patch: Partial<BuilderState>) => void;
};

export function FormSettingsFields({
  idPrefix,
  state,
  issues,
  nameTaken,
  publishedVersion,
  onPatch,
}: Props) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");

  const categoryItems = FORM_CATEGORY_VALUES.map((category) => ({
    value: category,
    label: tForms(`categories.${category}`),
  }));
  const appliesToItems = FORM_APPLIES_TO_VALUES.map((value) => ({
    value,
    label: tForms(`appliesTo.${value}`),
  }));
  const nameInvalid = Boolean(issues?.name) || nameTaken;

  return (
    <div className="grid gap-5">
      <Field data-invalid={nameInvalid}>
        <FieldLabel htmlFor={`${idPrefix}-name`} className={REQUIRED_LABEL_CLASS}>
          {t("nameLabel")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-name`}
          value={state.name}
          maxLength={FORM_NAME_MAX_LENGTH}
          placeholder={t("namePlaceholder")}
          aria-invalid={nameInvalid}
          onChange={(event) => onPatch({ name: event.target.value })}
        />
        <div className="flex items-start justify-between gap-3">
          {issues?.name ? (
            <FieldError errors={[{ message: t("errors.name") }]} />
          ) : nameTaken ? (
            <FieldError errors={[{ message: t("errors.nameTaken") }]} />
          ) : (
            <span />
          )}
          <CharacterCount value={state.name} max={FORM_NAME_MAX_LENGTH} />
        </div>
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
          onValueChange={(value: unknown) =>
            onPatch({ category: value as FormCategory })
          }
        >
          <SelectTrigger
            id={`${idPrefix}-category`}
            aria-invalid={Boolean(issues?.category)}
            className="w-full"
          >
            <SelectValue placeholder={t("categoryPlaceholder")} />
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

      <Field data-invalid={Boolean(issues?.appliesTo)}>
        <FieldLabel
          htmlFor={`${idPrefix}-applies-to`}
          className={REQUIRED_LABEL_CLASS}
        >
          {t("appliesToLabel")}
        </FieldLabel>
        <Select
          items={appliesToItems}
          value={state.appliesTo || null}
          onValueChange={(value: unknown) =>
            onPatch({ appliesTo: value as FormAppliesTo })
          }
        >
          <SelectTrigger
            id={`${idPrefix}-applies-to`}
            aria-invalid={Boolean(issues?.appliesTo)}
            className="w-full"
          >
            <SelectValue placeholder={t("appliesToPlaceholder")} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {appliesToItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  <span className="flex flex-col">
                    <span>{item.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {tForms(`appliesToHints.${item.value}`)}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {issues?.appliesTo ? (
          <FieldError errors={[{ message: t("errors.appliesTo") }]} />
        ) : (
          <FieldDescription>{t("appliesToHint")}</FieldDescription>
        )}
      </Field>

      <Field orientation="horizontal" className="items-start justify-between">
        <FieldContent>
          <FieldLabel htmlFor={`${idPrefix}-corrective`}>
            {t("correctiveLabel")}
          </FieldLabel>
          <FieldDescription>{t("correctiveDescription")}</FieldDescription>
        </FieldContent>
        <Switch
          id={`${idPrefix}-corrective`}
          checked={
            state.correctiveAction === CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL
          }
          onCheckedChange={(required) =>
            onPatch({
              correctiveAction: required
                ? CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL
                : CORRECTIVE_ACTION_MODE.OPTIONAL,
            })
          }
        />
      </Field>

      <Alert>
        <InfoIcon />
        <AlertDescription>
          {publishedVersion === null
            ? t("versionNoteNew")
            : t("versionNote", {
                version: publishedVersion,
                next: publishedVersion + 1,
              })}
        </AlertDescription>
      </Alert>
    </div>
  );
}
