"use client";

import type { FormDefinition, RecordValues } from "@haccp/shared";
import { CircleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useAnswerFormat } from "../hooks/use-answer-format";
import { describeAnswers } from "../lib/answer-summary";

type Props = {
  definition: FormDefinition | null;
  values: RecordValues;
  className?: string;
};

export function AnswerList({ definition, values, className }: Props) {
  const t = useTranslations("Forms");
  const format = useAnswerFormat();
  const lines = describeAnswers(definition, values, format.answers);

  return (
    <dl className={cn("flex flex-col divide-y", className)}>
      {lines.map((line) => (
        <div
          key={line.fieldId}
          className="flex items-baseline justify-between gap-4 py-2"
        >
          <dt className="min-w-0 text-sm text-muted-foreground">
            {line.label}
          </dt>
          <dd
            className={cn(
              "flex min-w-0 items-center gap-1.5 text-right text-sm font-medium [overflow-wrap:anywhere] whitespace-pre-wrap",
              line.fails && "text-destructive",
            )}
          >
            {line.fails ? (
              <CircleAlertIcon
                className="size-4 shrink-0"
                aria-label={t("measurement.outsideLimits")}
              />
            ) : null}
            {line.text}
          </dd>
        </div>
      ))}
    </dl>
  );
}
