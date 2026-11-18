"use client";

import {
  RECORD_RESULT,
  requiresCorrectiveAction,
  resolveLimits,
  type FormDefinition,
} from "@haccp/shared";
import { CheckIcon, CircleAlertIcon, EyeIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  createAnswerDraft,
  evaluateAnswerDraft,
  type AnswerDraft,
} from "../../lib/answer-draft";
import { decimalSeparator } from "../../lib/measurement";
import { AnswerFields } from "../answer-fields";

type Props = {
  definition: FormDefinition;
};

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

export function FormPreview({ definition }: Props) {
  const t = useTranslations("FormsPage.preview");
  const locale = useLocale();
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
      <Empty className="border">
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
  const needsAction = requiresCorrectiveAction(definition, evaluated.result);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        {evaluated.result === RECORD_RESULT.NOT_EVALUATED ? null : (
          <Badge
            variant={
              evaluated.result === RECORD_RESULT.PASS
                ? "success"
                : "destructive"
            }
          >
            {evaluated.result === RECORD_RESULT.PASS ? (
              <CheckIcon />
            ) : (
              <CircleAlertIcon />
            )}
            {t(`result.${evaluated.result}`)}
          </Badge>
        )}
      </div>

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

      {needsAction ? (
        <p className="rounded-lg bg-destructive/[0.06] px-3 py-2 text-sm">
          {t("correctiveActionRequired")}
        </p>
      ) : null}
    </div>
  );
}
