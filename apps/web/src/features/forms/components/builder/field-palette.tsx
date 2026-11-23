"use client";

import type { FieldType } from "@haccp/shared";
import { CircleAlertIcon, GripVerticalIcon, PlusIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_ICONS } from "../../lib/category-icon";
import type { FailRule } from "../../lib/form-builder";
import { formatMeasurementNumber } from "../../lib/measurement";
import { usePaletteDrag } from "./builder-dnd";

// Measurement leads: it is what most HACCP checks record.
const FIELD_TYPE_ORDER = [
  "measurement",
  "checkbox",
  "choice",
  "text",
  "date",
] as const satisfies readonly FieldType[];

type PaletteProps = {
  canAdd: boolean;
  onAdd: (type: FieldType) => void;
};

const TYPE_ROW_CLASS =
  "group/type h-auto w-full justify-start px-2 py-2 text-left font-normal [&>span]:w-full [&>span]:gap-3";

function TypeRowContent({
  type,
  trailing,
}: {
  type: FieldType;
  trailing: ReactNode;
}) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const Icon = FIELD_TYPE_ICONS[type];
  return (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
        <Icon aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{tForms(`fieldTypes.${type}`)}</span>
        <span className="text-xs whitespace-normal text-muted-foreground">
          {t(`fieldTypeHints.${type}`)}
        </span>
      </span>
      {trailing}
    </>
  );
}

/** One button per field type, each with its hint, so picking a type needs no prior knowledge. */
export function FieldTypeList({ canAdd, onAdd }: PaletteProps) {
  return (
    <ul className="flex flex-col gap-1">
      {FIELD_TYPE_ORDER.map((type) => (
        <li key={type}>
          <Button
            type="button"
            variant="ghost"
            disabled={!canAdd}
            className={TYPE_ROW_CLASS}
            onClick={() => onAdd(type)}
          >
            <TypeRowContent
              type={type}
              trailing={
                <PlusIcon className="text-muted-foreground" aria-hidden />
              }
            />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function PaletteRow({
  type,
  canAdd,
  onAdd,
}: { type: FieldType } & PaletteProps) {
  const { nodeRef, onPointerDown, isDragging, justDropped } = usePaletteDrag(
    type,
    "palette",
    !canAdd,
  );
  return (
    <li>
      <Button
        ref={nodeRef}
        type="button"
        variant="ghost"
        disabled={!canAdd}
        className={cn(
          TYPE_ROW_CLASS,
          "cursor-grab touch-none border-border bg-card px-2.5 shadow-xs hover:bg-muted/60",
          isDragging && "opacity-50",
        )}
        onPointerDown={onPointerDown}
        onClick={() => {
          if (!justDropped()) onAdd(type);
        }}
      >
        <TypeRowContent
          type={type}
          trailing={
            <GripVerticalIcon
              className="text-muted-foreground opacity-0 group-hover/type:opacity-100 group-focus-visible/type:opacity-100"
              aria-hidden
            />
          }
        />
      </Button>
    </li>
  );
}

/** Desktop palette: click adds below the selected field, or drag a type onto the form. */
export function FieldPalette({ canAdd, onAdd }: PaletteProps) {
  const t = useTranslations("FormsPage.builder");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-0.5 px-2">
        <h2 className="text-sm font-medium">{t("addFieldTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("addFieldHint")}</p>
      </div>
      {/* Padding keeps a pressed card's 1px nudge from scrolling the panel. */}
      <ul className="flex flex-col gap-2 p-1">
        {FIELD_TYPE_ORDER.map((type) => (
          <PaletteRow key={type} type={type} canAdd={canAdd} onAdd={onAdd} />
        ))}
      </ul>
    </div>
  );
}

function AddRowButton({
  type,
  canAdd,
  onAdd,
}: { type: FieldType } & PaletteProps) {
  const tForms = useTranslations("Forms");
  const { nodeRef, onPointerDown, isDragging, justDropped } = usePaletteDrag(
    type,
    "end",
    !canAdd,
  );
  const Icon = FIELD_TYPE_ICONS[type];
  return (
    <Button
      ref={nodeRef}
      type="button"
      variant="outline"
      size="sm"
      disabled={!canAdd}
      className={cn("cursor-grab touch-none", isDragging && "opacity-50")}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (!justDropped()) onAdd(type);
      }}
    >
      <Icon data-icon="inline-start" />
      {tForms(`fieldTypes.${type}`)}
    </Button>
  );
}

/** Below the last field: these always append at the end, whatever is selected. */
export function AddFieldRow({
  canAdd,
  onAdd,
  count,
}: PaletteProps & { count: number }) {
  const t = useTranslations("FormsPage.builder");
  const empty = count === 0;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-foreground/25 bg-background/60 p-4",
        empty && "py-8",
      )}
    >
      <span className="text-sm text-muted-foreground">
        {empty ? t("emptyCanvas") : t("addFieldEnd")}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {FIELD_TYPE_ORDER.map((type) => (
          <AddRowButton key={type} type={type} canAdd={canAdd} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
}

export function FailRulesSummary({ rules }: { rules: FailRule[] }) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const locale = useLocale();
  const headingId = useId();
  const orList = useMemo(
    () => new Intl.ListFormat(locale, { type: "disjunction" }),
    [locale],
  );

  function limitsRuleText(rule: Extract<FailRule, { kind: "limits" }>) {
    const value = (n: number) =>
      `${formatMeasurementNumber(n, rule.unit, locale)} ${tForms(`units.${rule.unit}.symbol`)}`;
    const { min, max } = rule.limits;
    if (min !== null && max !== null) {
      return t("failRuleRange", {
        field: rule.label,
        min: value(min),
        max: value(max),
      });
    }
    if (min !== null)
      return t("failRuleBelow", { field: rule.label, min: value(min) });
    return t("failRuleAbove", { field: rule.label, max: value(max ?? 0) });
  }

  return (
    <section className="flex flex-col gap-2.5" aria-labelledby={headingId}>
      <h3 id={headingId} className="text-sm font-medium">
        {t("failsWhenTitle")}
      </h3>
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
    </section>
  );
}
