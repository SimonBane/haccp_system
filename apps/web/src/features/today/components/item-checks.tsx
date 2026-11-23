"use client";

import type {
  AnswersInput,
  CorrectiveInput,
  FormVersionSummary,
} from "@haccp/shared";
import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import { primaryMeasurement } from "@/features/forms/lib/answer-summary";
import { FORM_CATEGORY_ICONS } from "@/features/forms/lib/category-icon";
import { cn } from "@/lib/utils";
import { savedCorrective } from "../lib/corrective-action";
import type { TodayCheck, TodayGroup } from "../lib/today-day";
import { CheckForm } from "./check-form";
import { StatusTile } from "./status-tile";

type Props = {
  group: TodayGroup;
  form: FormVersionSummary;
  onSave: (
    check: TodayCheck,
    values: AnswersInput,
    corrective?: CorrectiveInput,
  ) => Promise<boolean>;
  onComplete: () => void;
};

function firstOpen(group: TodayGroup, except?: string): string | null {
  return (
    group.checks.find((check) => !check.isDone && check.key !== except)?.key ??
    null
  );
}

/** Several items sharing a longer form: each opens on its own, in whatever order suits the walk round. */
export function ItemChecks({ group, form, onSave, onComplete }: Props) {
  const t = useTranslations("TodayPage");
  const format = useAnswerFormat();
  const [openKey, setOpenKey] = useState<string | null>(() => firstOpen(group));

  // Reset during render so another task opens on its own first unfilled item.
  const [resetFor, setResetFor] = useState(group.key);
  if (resetFor !== group.key) {
    setResetFor(group.key);
    setOpenKey(firstOpen(group));
  }

  const CategoryIcon = FORM_CATEGORY_ICONS[form.category];

  return (
    <div className="flex flex-col gap-3" data-testid="item-checks">
      <Accordion
        value={openKey ? [openKey] : []}
        onValueChange={(next: unknown[]) => {
          const last = next[next.length - 1];
          setOpenKey(typeof last === "string" ? last : null);
        }}
        className="overflow-hidden rounded-xl ring-1 ring-foreground/10"
      >
        {group.checks.map((check) => {
          const { task } = check;
          const isOpen = openKey === check.key;
          const reading = primaryMeasurement(task.values);
          // The limits show beside each reading once the item is open.
          const sub =
            task.area && task.area.id !== task.targetId ? task.area.name : null;
          const next = firstOpen(group, check.key);

          return (
            <AccordionItem
              key={check.key}
              value={check.key}
              data-testid="item-check"
            >
              <AccordionTrigger
                className={cn(
                  "min-h-14 items-center gap-3.5 rounded-none px-4 py-2 hover:bg-muted/60 hover:no-underline",
                  isOpen &&
                    "bg-primary/10 hover:bg-primary/10 dark:bg-primary/20",
                )}
              >
                {check.isDone ? (
                  <StatusTile
                    icon={check.isDeviation ? CircleAlertIcon : CheckIcon}
                    tone={check.isDeviation ? "destructive" : "success"}
                  />
                ) : (
                  <StatusTile icon={CategoryIcon} tone="muted" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span>{task.targetName ?? group.title}</span>
                  {sub ? (
                    <span className="text-xs font-normal text-muted-foreground tabular-nums">
                      {sub}
                    </span>
                  ) : null}
                </span>
                {check.isDone && reading ? (
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      reading.fails ? "text-destructive" : "text-success",
                    )}
                  >
                    {format.measurement(reading.value ?? 0, reading.unit)}
                  </span>
                ) : null}
              </AccordionTrigger>
              <AccordionContent className="px-4 pt-3 pb-5">
                <CheckForm
                  entryKey={check.key}
                  definition={form.definition}
                  limits={task.resolvedLimits}
                  initialValues={task.values}
                  initialCorrective={savedCorrective(task)}
                  saveLabel={
                    next ? t("items.saveNext") : t("recordDialog.save")
                  }
                  disabled={check.status === "upcoming"}
                  onSubmit={async (values, corrective) => {
                    const saved = await onSave(check, values, corrective);
                    if (saved) {
                      setOpenKey(next);
                      if (!next) onComplete();
                    }
                    return saved;
                  }}
                />
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
      <p className="text-xs text-muted-foreground">{t("items.anyOrder")}</p>
    </div>
  );
}
