"use client";

import {
  RECORD_RESULT,
  requiresCorrectiveAction,
  resolveLimits,
  type FormDefinition,
} from "@haccp/shared";
import {
  CheckIcon,
  CircleAlertIcon,
  EyeIcon,
  InfoIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  createAnswerDraft,
  evaluateAnswerDraft,
  validateAnswerDraft,
  type AnswerDraft,
} from "../../lib/answer-draft";
import { decimalSeparator } from "../../lib/measurement";
import { AnswerFields } from "../answer-fields";

type Props = {
  definition: FormDefinition;
  formName: string;
};

type Outcome = "pass" | "fail" | "incomplete";

/** The shape decides when to reset answers: retyping a label keeps them, adding a field or changing a unit does not. */
function shapeKey(definition: FormDefinition): string {
  return definition.fields
    .map((field) =>
      field.type === "measurement"
        ? `${field.id}:${field.unit}`
        : `${field.id}:${field.type}`,
    )
    .join("|");
}

const OUTCOME_BADGE = {
  pass: { variant: "success", Icon: CheckIcon },
  fail: { variant: "destructive", Icon: CircleAlertIcon },
  incomplete: { variant: "secondary", Icon: InfoIcon },
} as const;

/** Staff's form with live pass/fail judging, using the form's own limits; nothing is saved. */
export function FormPreview({ definition, formName }: Props) {
  const t = useTranslations("FormsPage.preview");
  const locale = useLocale();
  const isMobile = useIsMobile();
  const separator = useMemo(() => decimalSeparator(locale), [locale]);
  const limits = useMemo(() => resolveLimits(definition, null), [definition]);
  const shape = shapeKey(definition);

  const [state, setState] = useState<{ shape: string; draft: AnswerDraft }>(
    () => ({
      shape,
      draft: createAnswerDraft(definition, limits, null, separator),
    }),
  );

  // Reset during render, not in an effect, so a stale draft never renders against a new shape.
  if (state.shape !== shape) {
    setState({
      shape,
      draft: createAnswerDraft(definition, limits, null, separator),
    });
  }

  if (definition.fields.length === 0) {
    return (
      <Empty className="border bg-background">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <EyeIcon />
          </EmptyMedia>
          <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const evaluated = evaluateAnswerDraft(definition, limits, state.draft);
  const missing = validateAnswerDraft(definition, state.draft);
  const failed = new Set(evaluated.failedFieldIds);
  const needsAction = requiresCorrectiveAction(definition, evaluated.result);
  const outcome: Outcome =
    evaluated.result === RECORD_RESULT.FAIL
      ? "fail"
      : Object.keys(missing).length === 0
        ? "pass"
        : "incomplete";
  const badge = OUTCOME_BADGE[outcome];
  const resultBadge = (
    <Badge variant={badge.variant} data-testid="form-preview-result">
      <badge.Icon />
      {t(`outcome.${outcome}`)}
    </Badge>
  );

  const fields = (
    <AnswerFields
      idPrefix="form-preview"
      definition={definition}
      limits={limits}
      draft={state.draft}
      issues={{}}
      separator={separator}
      onChange={(fieldId, next) =>
        setState((current) => ({
          ...current,
          draft: { ...current.draft, [fieldId]: next },
        }))
      }
    />
  );

  const correctiveNotice = needsAction ? (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertTitle>{t("needsAttentionTitle")}</AlertTitle>
      <AlertDescription>{t("correctiveActionRequired")}</AlertDescription>
    </Alert>
  ) : null;

  const reset = () =>
    setState({
      shape,
      draft: createAnswerDraft(definition, limits, null, separator),
    });
  const record = () => toast.info(t("recordToast"));

  if (isMobile) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <RotateCcwIcon data-icon="inline-start" />
            {t("reset")}
          </Button>
        </div>
        {fields}
        {correctiveNotice}
        <div className="sticky bottom-0 -mx-4 flex flex-col gap-2.5 border-t bg-background px-4 pt-3 pb-4">
          <div
            className="flex items-center justify-between"
            aria-live="polite"
          >
            <span className="text-xs text-muted-foreground">
              {t("resultIfRecorded")}
            </span>
            {resultBadge}
          </div>
          <Button type="button" className="h-14 rounded-2xl text-base" onClick={record}>
            {t("record")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-center gap-6">
      <Card className="w-[25rem] max-w-full gap-0 py-0 shadow-lg">
        <div className="flex flex-col gap-1 px-6 pt-5 pb-4">
          <h2 className="truncate text-base font-medium">{formName}</h2>
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
        </div>
        <div className="flex flex-col gap-5 px-6 pb-5">
          {fields}
          {correctiveNotice}
        </div>
        <div className="flex justify-end gap-2 rounded-b-xl border-t bg-muted/50 px-6 py-4">
          <Button type="button" onClick={record}>
            {t("record")}
          </Button>
        </div>
      </Card>

      <aside className="flex w-80 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">{t("tryTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("tryDescription")}</p>
        </div>
        <Card className="gap-3 px-4 py-4" aria-live="polite">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("resultTitle")}</span>
            {resultBadge}
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {definition.fields.map((field) => {
              const isFailed = failed.has(field.id);
              const isMissing = missing[field.id] === "required";
              if (!isFailed && !isMissing) return null;
              return (
                <li key={field.id} className="flex items-start gap-2">
                  {isFailed ? (
                    <CircleAlertIcon
                      className="mt-0.5 size-3.5 shrink-0 text-destructive"
                      aria-hidden
                    />
                  ) : (
                    <InfoIcon
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                  <span className={cn(!isFailed && "text-muted-foreground")}>
                    {t(isFailed ? "reasonFailed" : "reasonMissing", {
                      field: field.label,
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
          {outcome === "pass" ? (
            <p className="text-sm text-muted-foreground">{t("reasonAllPass")}</p>
          ) : null}
        </Card>
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={reset}
        >
          <RotateCcwIcon data-icon="inline-start" />
          {t("reset")}
        </Button>
      </aside>
    </div>
  );
}
