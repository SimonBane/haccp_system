"use client";

import { FIELD_TYPE } from "@haccp/shared";
import {
  ChevronRightIcon,
  CircleAlertIcon,
  GripVerticalIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_ICONS } from "../../lib/category-icon";
import type { BuilderField, BuilderIssues } from "../../lib/form-builder";
import { useAnswerFormat } from "../../hooks/use-answer-format";
import { parseMeasurementDraft } from "../../lib/measurement";
import { useSortableField } from "./builder-dnd";

type Props = {
  fields: BuilderField[];
  issues: BuilderIssues | null;
  onOpen: (fieldId: string) => void;
};

function useFieldMeta() {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const format = useAnswerFormat();

  return (field: BuilderField): string => {
    const parts = [tForms(`fieldTypes.${field.type}`)];

    if (field.type === FIELD_TYPE.MEASUREMENT) {
      const min = field.limits.min.trim()
        ? parseMeasurementDraft(field.limits.min)
        : null;
      const max = field.limits.max.trim()
        ? parseMeasurementDraft(field.limits.max)
        : null;
      const limits = format.limits({ min, max }, field.unit);
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

function FieldRow({
  field,
  index,
  meta,
  hasIssues,
  onOpen,
}: {
  field: BuilderField;
  index: number;
  meta: string;
  hasIssues: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("FormsPage.builder");
  const { nodeRef, handleRef, handleProps, style, isDragging } =
    useSortableField(field.id);
  const Icon = FIELD_TYPE_ICONS[field.type];
  const title = field.label.trim() || t("untitled");

  return (
    <li
      ref={nodeRef}
      style={style}
      className={cn(
        "relative flex border-b bg-card last:border-b-0",
        isDragging &&
          "z-10 rounded-xl border-b-0 shadow-lg ring-1 ring-foreground/10",
      )}
    >
      <Button
        ref={handleRef}
        {...handleProps}
        type="button"
        variant="ghost"
        className="h-auto w-11 shrink-0 cursor-grab touch-none rounded-none text-muted-foreground"
        aria-label={t("dragHandle", { label: title })}
      >
        <GripVerticalIcon className="size-5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-h-16 min-w-0 flex-1 justify-start rounded-none py-3 pr-4 pl-1 text-left font-normal [&>span]:w-full [&>span]:gap-3"
        aria-label={t("editField", { index: index + 1, label: title })}
        onClick={onOpen}
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
            {meta}
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
}

/** Phone layout of the canvas: one row per field, the grip reorders it, a tap edits it in a sheet. */
export function MobileFieldList({ fields, issues, onOpen }: Props) {
  const meta = useFieldMeta();

  return (
    <ol className="rounded-xl bg-card shadow-xs ring-1 ring-foreground/10 [&>li:first-child]:rounded-t-xl [&>li:last-child]:rounded-b-xl">
      {fields.map((field, index) => (
        <FieldRow
          key={field.id}
          field={field}
          index={index}
          meta={meta(field)}
          hasIssues={Boolean(issues?.byField[field.id])}
          onOpen={() => onOpen(field.id)}
        />
      ))}
    </ol>
  );
}
