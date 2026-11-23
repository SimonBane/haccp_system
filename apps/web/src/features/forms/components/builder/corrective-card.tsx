"use client";

import type { CorrectiveSettings } from "@haccp/shared";
import { ChevronRightIcon, CircleAlertIcon, WrenchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { correctiveNoteShown, type FailRule } from "../../lib/form-builder";
import { CorrectiveAnswers } from "../corrective-answers";
import { FailRulesSummary } from "./field-palette";

type Props = {
  on: boolean;
  corrective: CorrectiveSettings;
  rules: FailRule[];
  selected: boolean;
  hasIssues: boolean;
  /** Phone layout: a summary line instead of the inert preview, and a chevron into the sheet. */
  compact: boolean;
  onSelect: () => void;
  onToggle: (on: boolean) => void;
};

/** The last step of every form: what makes a record fail, and what staff then record. Always shown, on or off. */
export function CorrectiveCard({
  on,
  corrective,
  rules,
  selected,
  hasIssues,
  compact,
  onSelect,
  onToggle,
}: Props) {
  const t = useTranslations("FormsPage.builder");
  const tToday = useTranslations("TodayPage");
  const noteShown = correctiveNoteShown(corrective);

  const subtitle = !on
    ? t("corrective.offDescription")
    : compact
      ? t("corrective.meta", { count: corrective.answers.length })
      : t("corrective.onDescription");

  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-xl transition-shadow",
        compact ? "p-4" : "px-6 py-5",
        on
          ? "bg-card shadow-xs ring-1 ring-foreground/10 hover:ring-foreground/20"
          : "border border-dashed border-foreground/25",
        selected && "shadow-md ring-2 ring-primary hover:ring-primary",
        hasIssues && "ring-2 ring-destructive hover:ring-destructive",
      )}
      data-testid="form-builder-corrective-card"
    >
      <Button
        type="button"
        variant="ghost"
        className="absolute inset-0 z-[1] h-auto rounded-[inherit] p-0 hover:bg-transparent"
        aria-label={t("corrective.editCard")}
        aria-pressed={compact ? undefined : selected}
        onClick={onSelect}
      />

      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
          <WrenchIcon className="size-4" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-medium">{t("corrective.heading")}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {subtitle}
          </span>
        </div>
        {hasIssues ? (
          <CircleAlertIcon
            className="size-4 shrink-0 text-destructive"
            aria-label={t("needsAttention")}
          />
        ) : null}
        <Switch
          className="relative z-[2]"
          checked={on}
          onCheckedChange={onToggle}
          aria-label={t("corrective.heading")}
        />
        {compact ? (
          <ChevronRightIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>

      <FailRulesSummary rules={rules} />

      {on && !compact ? (
        <div inert className="flex flex-col gap-3.5 border-t pt-4">
          {corrective.answers.length > 0 ? (
            <CorrectiveAnswers
              answers={corrective.answers}
              multiple={corrective.multiple}
              selected={[]}
              untitledLabel={t("corrective.untitledAnswer")}
              onToggle={() => {}}
            />
          ) : null}
          {noteShown ? (
            <div className="flex flex-col gap-2">
              {corrective.answers.length > 0 ? (
                <span className="text-sm font-medium">
                  {tToday("recordDialog.notesLabel")}
                </span>
              ) : null}
              <div className="h-14 rounded-md border border-input bg-background px-2.5 pt-2 text-sm text-muted-foreground">
                {corrective.answers.length > 0
                  ? tToday("recordDialog.notesPlaceholder")
                  : tToday("recordDialog.noteOnlyPlaceholder")}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
