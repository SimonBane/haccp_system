"use client";

import { FIELD_TYPE } from "@haccp/shared";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  CircleAlertIcon,
  CopyIcon,
  GripVerticalIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_ICONS } from "../../lib/category-icon";
import type { BuilderField, FieldIssues } from "../../lib/form-builder";
import { useAnswerFormat } from "../../hooks/use-answer-format";
import { parseMeasurementDraft } from "../../lib/measurement";
import { LimitChip } from "../limit-chip";
import { useSortableField } from "./builder-dnd";

type Props = {
  field: BuilderField;
  index: number;
  count: number;
  selected: boolean;
  issues: FieldIssues | undefined;
  onSelect: () => void;
  onMove: (delta: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
};

function issueMessageKey(issues: FieldIssues) {
  if (issues.label) return "errors.label";
  if (issues.limits) return `errors.limits.${issues.limits}` as const;
  return "errors.optionLabel";
}

/** The field as staff will see it, inert; clicking selects it, the grip reorders it. */
export function FieldCard({
  field,
  index,
  count,
  selected,
  issues,
  onSelect,
  onMove,
  onDuplicate,
  onRemove,
}: Props) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const { nodeRef, handleRef, handleProps, style, isDragging } =
    useSortableField(field.id);
  const TypeIcon = FIELD_TYPE_ICONS[field.type];
  const title = field.label.trim() || t("untitled");

  return (
    <div
      ref={nodeRef}
      style={style}
      className={cn(
        "group/card relative flex flex-col gap-3 rounded-xl bg-card py-5 pr-5 pl-14 shadow-xs ring-1 ring-foreground/10 transition-shadow",
        !selected && "hover:ring-foreground/20",
        issues && "ring-destructive",
        selected && "shadow-md ring-2 ring-primary",
        selected && issues && "ring-destructive",
        isDragging && "z-10 shadow-lg",
      )}
      data-testid="form-builder-field"
    >
      <Button
        type="button"
        variant="ghost"
        className="absolute inset-0 z-[1] h-auto rounded-[inherit] p-0 hover:bg-transparent"
        aria-label={t("editField", { index: index + 1, label: title })}
        aria-pressed={selected}
        onClick={onSelect}
        data-field-select
      />
      <Button
        ref={handleRef}
        {...handleProps}
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-4 left-3 z-[2] cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label={t("dragHandle", { label: title })}
      >
        <GripVerticalIcon />
      </Button>

      <div
        role="toolbar"
        aria-label={t("fieldActions")}
        className={cn(
          "absolute -top-4 right-4 z-[2] flex gap-0.5 rounded-lg bg-popover p-0.5 shadow-md ring-1 ring-foreground/10 transition-opacity",
          "pointer-events-none opacity-0 group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-has-[:focus-visible]/card:pointer-events-auto group-has-[:focus-visible]/card:opacity-100",
          isDragging && "hidden",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("moveUp", { label: title })}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("moveDown", { label: title })}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDownIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("duplicateField", { label: title })}
          onClick={onDuplicate}
        >
          <CopyIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={t("removeField", { label: title })}
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2.5">
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold tabular-nums",
                selected && "bg-primary text-primary-foreground",
              )}
              aria-hidden
            >
              {index + 1}
            </span>
            <span
              className={cn(
                "text-base font-medium",
                !field.label.trim() && "text-muted-foreground",
                field.required &&
                  "after:ml-0.5 after:text-destructive after:content-['*']",
              )}
            >
              {title}
            </span>
          </span>
          {field.help?.trim() ? (
            <span className="pl-[2.125rem] text-sm text-muted-foreground">
              {field.help}
            </span>
          ) : null}
        </div>
        <Badge variant="secondary">
          <TypeIcon aria-hidden />
          {tForms(`fieldTypes.${field.type}`)}
        </Badge>
      </div>

      <div aria-hidden className="flex flex-col gap-2">
        <FieldGhost field={field} />
      </div>

      {issues ? (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <CircleAlertIcon className="size-4" aria-hidden />
          {t(issueMessageKey(issues))}
        </p>
      ) : null}
    </div>
  );
}

const GHOST =
  "flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm text-muted-foreground";

function FieldGhost({ field }: { field: BuilderField }) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const format = useAnswerFormat();

  switch (field.type) {
    case FIELD_TYPE.MEASUREMENT: {
      const symbol = tForms(`units.${field.unit}.symbol`);
      const min = field.limits.min.trim()
        ? parseMeasurementDraft(field.limits.min)
        : null;
      const max = field.limits.max.trim()
        ? parseMeasurementDraft(field.limits.max)
        : null;
      const limits = format.limits({ min, max }, field.unit);
      return (
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn(GHOST, "w-40 justify-between tabular-nums")}>
            <span>0</span>
            <span>{symbol}</span>
          </div>
          {limits ? (
            <LimitChip
              limits={limits}
              label={tForms("measurement.allowed", { limits })}
            />
          ) : null}
        </div>
      );
    }
    case FIELD_TYPE.CHECKBOX:
      return (
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="size-4 rounded border border-foreground/25" />
          {t("tickToConfirm")}
        </div>
      );
    case FIELD_TYPE.CHOICE:
      return (
        <>
          {field.options.map((option) => (
            <div
              key={option.id}
              className="flex min-h-7 items-center gap-2.5 text-sm"
            >
              <span
                className={cn(
                  "size-4 shrink-0 border border-foreground/25",
                  field.multiple ? "rounded" : "rounded-full",
                )}
              />
              <span
                className={cn(!option.label.trim() && "text-muted-foreground")}
              >
                {option.label.trim() || t("untitledOption")}
              </span>
              {option.fails ? (
                <Badge variant="destructive">{t("optionFails")}</Badge>
              ) : null}
            </div>
          ))}
        </>
      );
    case FIELD_TYPE.TEXT:
      return (
        <div className={cn(GHOST, field.multiline && "h-16 items-start pt-2")}>
          {t("typeNote")}
        </div>
      );
    case FIELD_TYPE.DATE:
      return (
        <div className={cn(GHOST, "w-44")}>
          <CalendarIcon className="size-4" />
          {t("pickDate")}
        </div>
      );
  }
}
