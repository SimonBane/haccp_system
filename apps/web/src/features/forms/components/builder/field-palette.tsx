"use client";

import { fieldTypeSchema, type FieldType } from "@haccp/shared";
import { CircleAlertIcon, PlusIcon, ShieldCheckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FIELD_TYPE_ICONS } from "../../lib/category-icon";
import type { FailRule } from "../../lib/form-builder";
import { formatMeasurementNumber } from "../../lib/measurement";

type PaletteProps = {
  canAdd: boolean;
  onAdd: (type: FieldType) => void;
};

/** One button per field type, each with its hint, so picking a type needs no prior knowledge. */
export function FieldTypeList({ canAdd, onAdd }: PaletteProps) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");

  return (
    <ul className="flex flex-col gap-1">
      {fieldTypeSchema.options.map((type) => {
        const Icon = FIELD_TYPE_ICONS[type];
        return (
          <li key={type}>
            <Button
              type="button"
              variant="ghost"
              disabled={!canAdd}
              className="group/type h-auto w-full justify-start px-2 py-2 text-left font-normal [&>span]:w-full [&>span]:gap-3"
              onClick={() => onAdd(type)}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                <Icon aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{tForms(`fieldTypes.${type}`)}</span>
                <span className="text-xs whitespace-normal text-muted-foreground">
                  {t(`fieldTypeHints.${type}`)}
                </span>
              </span>
              <PlusIcon
                className="text-muted-foreground opacity-0 group-hover/type:opacity-100 group-focus-visible/type:opacity-100"
                aria-hidden
              />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function FailRulesSummary({
  rules,
  correctiveRequired,
}: {
  rules: FailRule[];
  correctiveRequired: boolean;
}) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const locale = useLocale();
  const orList = useMemo(
    () => new Intl.ListFormat(locale, { type: "disjunction" }),
    [locale],
  );

  function limitsRuleText(rule: Extract<FailRule, { kind: "limits" }>) {
    const value = (n: number) =>
      `${formatMeasurementNumber(n, rule.unit, locale)} ${tForms(`units.${rule.unit}.symbol`)}`;
    const { min, max } = rule.limits;
    if (min !== null && max !== null) {
      return t("failRuleRange", { field: rule.label, min: value(min), max: value(max) });
    }
    if (min !== null) return t("failRuleBelow", { field: rule.label, min: value(min) });
    return t("failRuleAbove", { field: rule.label, max: value(max ?? 0) });
  }

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby="fails-when">
      <h2 id="fails-when" className="text-sm font-medium">
        {t("failsWhenTitle")}
      </h2>
      {rules.length > 0 ? (
        <ul className="flex flex-col gap-2 text-sm">
          {rules.map((rule) => (
            <li key={rule.fieldId} className="flex items-start gap-2">
              <CircleAlertIcon
                className="mt-0.5 size-3.5 shrink-0 text-destructive"
                aria-hidden
              />
              <span>
                {rule.kind === "options"
                  ? t("failRuleOptions", {
                      field: rule.label,
                      options: orList.format(rule.options),
                    })
                  : limitsRuleText(rule)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("failsWhenEmpty")}</p>
      )}
      {correctiveRequired ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldCheckIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
          {t("failsWhenCorrective")}
        </p>
      ) : null}
    </section>
  );
}

export function FieldPalette({
  canAdd,
  onAdd,
  rules,
  correctiveRequired,
}: PaletteProps & { rules: FailRule[]; correctiveRequired: boolean }) {
  const t = useTranslations("FormsPage.builder");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5 px-2">
        <h2 className="text-sm font-medium">{t("addFieldTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("addFieldHint")}</p>
      </div>
      <FieldTypeList canAdd={canAdd} onAdd={onAdd} />
      <Separator />
      <div className="px-2">
        <FailRulesSummary rules={rules} correctiveRequired={correctiveRequired} />
      </div>
    </div>
  );
}
