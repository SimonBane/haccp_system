"use client";

import {
  FORM_NAME_MAX_LENGTH,
  CORRECTIVE_ACTION_MODE,
  FORM_APPLIES_TO,
  FORM_APPLIES_TO_VALUES,
  FORM_CATEGORY_VALUES,
  type FormAppliesTo,
  type FormCategory,
} from "@haccp/shared";
import {
  ArrowLeftIcon,
  BuildingIcon,
  ChevronRightIcon,
  LayersIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CharacterCount } from "@/components/character-count";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_ICONS, FORM_CATEGORY_ICONS } from "../../lib/category-icon";
import type { BuilderState } from "../../lib/form-builder";
import { CHIP_CLASS } from "./template-step";

const APPLIES_TO_ICONS: Record<FormAppliesTo, LucideIcon> = {
  [FORM_APPLIES_TO.PER_ITEM]: LayersIcon,
  [FORM_APPLIES_TO.LOCATION]: BuildingIcon,
};

type Props = {
  state: BuilderState;
  /** Shown beside the form so the admin sees what they are starting from; null for a blank form. */
  sourceName: string | null;
  onChange: (next: BuilderState) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function SetupStep({ state, sourceName, onChange, onBack, onContinue }: Props) {
  const t = useTranslations("FormsPage.create");
  const tBuilder = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const isMobile = useIsMobile();
  const [showIssues, setShowIssues] = useState(false);

  const nameMissing = state.name.trim() === "";
  const categoryMissing = state.category === "";
  const appliesToMissing = state.appliesTo === "";

  function patch(next: Partial<BuilderState>) {
    onChange({ ...state, ...next });
  }

  function handleContinue() {
    if (nameMissing || categoryMissing || appliesToMissing) {
      setShowIssues(true);
      return;
    }
    onContinue();
  }

  const continueButton = (
    <Button
      type="button"
      className={cn(isMobile && "h-14 w-full rounded-2xl text-base")}
      onClick={handleContinue}
      data-testid="form-setup-continue"
    >
      {t("continue")}
      <ChevronRightIcon data-icon="inline-end" />
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <div className="flex flex-wrap items-start gap-12">
        <div className="flex min-w-0 flex-[999_1_32rem] flex-col gap-7">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{t("setupTitle")}</h1>
            <p className="text-sm text-muted-foreground">{t("setupDescription")}</p>
          </div>

          <Field data-invalid={showIssues && nameMissing}>
            <FieldLabel htmlFor="form-setup-name" className={REQUIRED_LABEL_CLASS}>
              {tBuilder("nameLabel")}
            </FieldLabel>
            <Input
              id="form-setup-name"
              className="max-w-md"
              value={state.name}
              maxLength={FORM_NAME_MAX_LENGTH}
              placeholder={tBuilder("namePlaceholder")}
              aria-invalid={showIssues && nameMissing}
              onChange={(event) => patch({ name: event.target.value })}
            />
            <div className="flex max-w-md items-start justify-between gap-3">
              {showIssues && nameMissing ? (
                <FieldError errors={[{ message: tBuilder("errors.name") }]} />
              ) : (
                <FieldDescription>{t("nameHint")}</FieldDescription>
              )}
              <CharacterCount value={state.name} max={FORM_NAME_MAX_LENGTH} />
            </div>
          </Field>

          <FieldSet data-invalid={showIssues && categoryMissing}>
            <FieldLegend variant="label" className={REQUIRED_LABEL_CLASS}>
              {tBuilder("categoryLabel")}
            </FieldLegend>
            <ToggleGroup
              aria-label={tBuilder("categoryLabel")}
              value={state.category ? [state.category] : []}
              onValueChange={(next) => {
                const value = next[0] as FormCategory | undefined;
                if (value) patch({ category: value });
              }}
              className="flex-wrap gap-2"
            >
              {FORM_CATEGORY_VALUES.map((category) => {
                const Icon = FORM_CATEGORY_ICONS[category];
                return (
                  <ToggleGroupItem
                    key={category}
                    value={category}
                    className={cn(CHIP_CLASS, isMobile && "h-10")}
                  >
                    <Icon aria-hidden />
                    {tForms(`categories.${category}`)}
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            {showIssues && categoryMissing ? (
              <FieldError errors={[{ message: tBuilder("errors.category") }]} />
            ) : null}
          </FieldSet>

          <FieldSet data-invalid={showIssues && appliesToMissing}>
            <FieldLegend variant="label" className={REQUIRED_LABEL_CLASS}>
              {tBuilder("appliesToLabel")}
            </FieldLegend>
            <ToggleGroup
              aria-label={tBuilder("appliesToLabel")}
              value={state.appliesTo ? [state.appliesTo] : []}
              onValueChange={(next) => {
                const value = next[0] as FormAppliesTo | undefined;
                if (value) patch({ appliesTo: value });
              }}
              className="grid w-full gap-2.5 sm:grid-cols-2"
            >
              {FORM_APPLIES_TO_VALUES.map((value) => {
                const Icon = APPLIES_TO_ICONS[value];
                return (
                  <ToggleGroupItem
                    key={value}
                    value={value}
                    className="group/card h-auto w-full items-start justify-start gap-3 rounded-xl border border-input p-3.5 text-left font-normal whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/[0.04] aria-pressed:ring-1 aria-pressed:ring-primary"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted group-aria-pressed/card:bg-primary group-aria-pressed/card:text-primary-foreground">
                      <Icon aria-hidden />
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{tForms(`appliesTo.${value}`)}</span>
                      <span className="text-sm text-muted-foreground">
                        {tForms(`appliesToHints.${value}`)}
                      </span>
                    </span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
            {showIssues && appliesToMissing ? (
              <FieldError errors={[{ message: tBuilder("errors.appliesTo") }]} />
            ) : (
              <FieldDescription>{tBuilder("appliesToHint")}</FieldDescription>
            )}
          </FieldSet>

          <Card className="px-4 py-4">
            <Field orientation="horizontal" className="items-start justify-between">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                <ShieldCheckIcon className="size-4" aria-hidden />
              </span>
              <FieldContent>
                <FieldLabel htmlFor="form-setup-corrective">
                  {tBuilder("correctiveLabel")}
                </FieldLabel>
                <FieldDescription>{tBuilder("correctiveDescription")}</FieldDescription>
              </FieldContent>
              <Switch
                id="form-setup-corrective"
                checked={
                  state.correctiveAction === CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL
                }
                onCheckedChange={(required) =>
                  patch({
                    correctiveAction: required
                      ? CORRECTIVE_ACTION_MODE.REQUIRED_ON_FAIL
                      : CORRECTIVE_ACTION_MODE.OPTIONAL,
                  })
                }
              />
            </Field>
          </Card>
        </div>

        {state.fields.length > 0 && !isMobile ? (
          <aside className="flex-[1_1_18rem]">
            <Card className="gap-4 px-5 py-5">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{t("startingFrom")}</span>
                <span className="font-medium">{sourceName ?? state.name}</span>
              </div>
              <ul className="flex flex-col gap-2.5 text-sm">
                {state.fields.map((field) => {
                  const Icon = FIELD_TYPE_ICONS[field.type];
                  return (
                    <li key={field.id} className="flex items-center gap-2.5">
                      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted">
                        <Icon className="size-3.5" aria-hidden />
                      </span>
                      <span className="truncate">{field.label}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="border-t pt-3 text-xs text-muted-foreground">{t("fieldsNext")}</p>
            </Card>
          </aside>
        ) : null}
      </div>

      {isMobile ? (
        <div className="sticky bottom-0 -mx-4 border-t bg-background px-4 pt-3 pb-4">
          {continueButton}
        </div>
      ) : (
        <div className="flex justify-between gap-3 border-t pt-4">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeftIcon data-icon="inline-start" />
            {t("back")}
          </Button>
          {continueButton}
        </div>
      )}
    </div>
  );
}
