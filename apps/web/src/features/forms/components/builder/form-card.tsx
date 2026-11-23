"use client";

import type { FormAppliesTo, FormCategory } from "@haccp/shared";
import { ChevronRightIcon, PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FORM_CATEGORY_ICONS } from "../../lib/category-icon";

type Props = {
  name: string;
  category: FormCategory | "";
  appliesTo: FormAppliesTo | "";
  selected: boolean;
  /** Issues are being shown and the name, category or "filled in for" is missing. */
  hasIssues: boolean;
  /** Phone layout: smaller type and a chevron into the sheet. */
  compact: boolean;
  onSelect: () => void;
};

const TODO_BADGE = "border-dashed border-foreground/25 text-muted-foreground";

/** First card on the canvas: the form's name and what it is, and the way into its details. */
export function FormCard({
  name,
  category,
  appliesTo,
  selected,
  hasIssues,
  compact,
  onSelect,
}: Props) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const CategoryIcon = category ? FORM_CATEGORY_ICONS[category] : null;
  const todo = cn(
    TODO_BADGE,
    hasIssues && "border-destructive text-destructive",
  );

  return (
    <div
      className={cn(
        "relative flex items-center gap-4 rounded-xl bg-card shadow-xs ring-1 ring-foreground/10 transition-shadow hover:ring-foreground/20",
        compact ? "py-3.5 pr-3 pl-4" : "px-6 py-5",
        selected && "shadow-md ring-2 ring-primary hover:ring-primary",
        hasIssues && "ring-2 ring-destructive hover:ring-destructive",
      )}
      data-testid="form-builder-form-card"
    >
      <Button
        type="button"
        variant="ghost"
        className="absolute inset-0 z-[1] h-auto rounded-[inherit] p-0 hover:bg-transparent"
        aria-label={t("editFormDetails")}
        aria-pressed={compact ? undefined : selected}
        onClick={onSelect}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2
          className={cn(
            "truncate font-medium",
            compact ? "text-base" : "text-lg",
            !name.trim() && "text-muted-foreground",
          )}
        >
          {name.trim() || t("untitledForm")}
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {category && CategoryIcon ? (
            <Badge variant="outline">
              <CategoryIcon aria-hidden />
              {tForms(`categories.${category}`)}
            </Badge>
          ) : (
            <Badge variant="outline" className={todo}>
              {t("categoryMissing")}
            </Badge>
          )}
          {appliesTo ? (
            <Badge variant="outline">{tForms(`appliesTo.${appliesTo}`)}</Badge>
          ) : (
            <Badge variant="outline" className={todo}>
              {t("appliesToMissing")}
            </Badge>
          )}
        </div>
      </div>
      {compact ? (
        <ChevronRightIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <PencilIcon className="size-3.5" aria-hidden />
          {t("formDetails")}
        </span>
      )}
    </div>
  );
}
