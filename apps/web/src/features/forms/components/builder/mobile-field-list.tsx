"use client";

import { FIELD_TYPE } from "@haccp/shared";
import { ChevronRightIcon, CircleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_ICONS } from "../../lib/category-icon";
import type { BuilderField, BuilderIssues } from "../../lib/form-builder";
import { formatLimits, parseMeasurementDraft } from "../../lib/measurement";

type Props = {
  fields: BuilderField[];
  issues: BuilderIssues | null;
  onOpen: (fieldId: string) => void;
};

function useFieldMeta() {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const locale = useLocale();

  return (field: BuilderField): string => {
    const parts = [tForms(`fieldTypes.${field.type}`)];

    if (field.type === FIELD_TYPE.MEASUREMENT) {
      const min = field.limits.min.trim() ? parseMeasurementDraft(field.limits.min) : null;
      const max = field.limits.max.trim() ? parseMeasurementDraft(field.limits.max) : null;
      const limits = formatLimits(
        { min, max },
        field.unit,
        locale,
        tForms(`units.${field.unit}.symbol`),
      );
      if (limits) parts.push(limits);
    }
    if (field.type === FIELD_TYPE.CHOICE) {
      parts.push(
        t("failingOptions", {
          failing: field.options.filter((option) => option.fails).length,
          total: field.options.length,
        }),
      );
    }
    parts.push(field.required ? t("required") : t("optional"));
    return parts.join(" · ");
  };
}

/** Phone layout of the canvas: one tappable row per field, editing happens in a sheet. */
export function MobileFieldList({ fields, issues, onOpen }: Props) {
  const t = useTranslations("FormsPage.builder");
  const meta = useFieldMeta();

  return (
    <ol className="overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-foreground/10">
      {fields.map((field, index) => {
        const Icon = FIELD_TYPE_ICONS[field.type];
        const hasIssues = Boolean(issues?.byField[field.id]);
        const title = field.label.trim() || t("untitled");
        return (
          <li key={field.id} className="border-b last:border-b-0">
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-16 w-full justify-start rounded-none px-4 py-3 text-left font-normal [&>span]:w-full [&>span]:gap-3"
              aria-label={t("editField", { index: index + 1, label: title })}
              onClick={() => onOpen(field.id)}
              data-testid="form-builder-field"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    "truncate font-medium",
                    !field.label.trim() && "text-muted-foreground",
                  )}
                >
                  {title}
                </span>
                <span className="truncate text-xs text-muted-foreground tabular-nums">
                  {meta(field)}
                </span>
              </span>
              {hasIssues ? (
                <CircleAlertIcon
                  className="size-4 shrink-0 text-destructive"
                  aria-label={t("needsAttention")}
                />
              ) : null}
              <ChevronRightIcon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Button>
          </li>
        );
      })}
    </ol>
  );
}
