"use client";

import type { DroppedOverride, MeasurementUnit } from "@haccp/shared";
import {
  CalendarPlusIcon,
  CheckIcon,
  CircleCheckIcon,
  LockIcon,
  SendIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useAnswerFormat } from "../../hooks/use-answer-format";
import type { FailRule } from "../../lib/form-builder";
import { FailRulesSummary } from "./field-palette";

export type PublishStep =
  | { kind: "confirm"; nextVersion: number }
  | { kind: "drops"; nextVersion: number; dropped: DroppedOverride[] }
  | { kind: "done"; version: number };

export type PublishSummary = {
  formName: string;
  fieldCount: number;
  appliesToLabel: string;
  rules: FailRule[];
  hasCorrective: boolean;
};

type Props = {
  step: PublishStep | null;
  summary: PublishSummary;
  /** Units the dropped overrides were set in, by field id, so their limits read correctly. */
  unitsByField: Record<string, MeasurementUnit>;
  isPublishing: boolean;
  onCancel: () => void;
  onConfirm: (step: Exclude<PublishStep, { kind: "done" }>) => void;
};

export function PublishDialog({
  step,
  summary,
  unitsByField,
  isPublishing,
  onCancel,
  onConfirm,
}: Props) {
  const t = useTranslations("FormsPage.publish");

  return (
    <AlertDialog
      open={step !== null}
      onOpenChange={(open) => {
        if (!open && !isPublishing) onCancel();
      }}
    >
      <AlertDialogContent className="sm:max-w-lg">
        {step?.kind === "done" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-success text-success-foreground">
                <CircleCheckIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>
                {t("doneTitle", { name: summary.formName })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("doneDescription", { version: step.version })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                variant="outline"
                render={<Link href="/dashboard/forms" />}
                nativeButton={false}
              >
                {t("backToForms")}
              </Button>
              <Button
                render={<Link href="/dashboard/task-templates" />}
                nativeButton={false}
              >
                <CalendarPlusIcon data-icon="inline-start" />
                {t("createTask")}
              </Button>
            </AlertDialogFooter>
          </>
        ) : step?.kind === "drops" ? (
          <DropsContent
            step={step}
            unitsByField={unitsByField}
            isPublishing={isPublishing}
            onConfirm={onConfirm}
          />
        ) : step?.kind === "confirm" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("title", { version: step.nextVersion })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {step.nextVersion === 1
                  ? t("createDescription", { name: summary.formName })
                  : t("description")}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <dl className="divide-y rounded-lg bg-muted px-4 text-sm">
              {[
                [t("summaryFields"), String(summary.fieldCount)],
                [t("summaryAppliesTo"), summary.appliesToLabel],
                [
                  t("summaryOnFail"),
                  summary.hasCorrective ? t("onFailRequired") : t("onFailOff"),
                ],
              ].map(([term, value]) => (
                <div key={term} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">{term}</dt>
                  <dd className="text-right tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>

            <FailRulesSummary rules={summary.rules} />

            <p className="flex items-center gap-2 text-sm">
              <CheckIcon className="size-4 text-success" aria-hidden />
              {t("noIssues")}
            </p>
            <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
              <LockIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("lockNote")}
            </p>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPublishing}>
                {t("cancel")}
              </AlertDialogCancel>
              <AlertDialogAction
                isLoading={isPublishing}
                onClick={() => onConfirm(step)}
              >
                <SendIcon data-icon="inline-start" />
                {t("confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DropsContent({
  step,
  unitsByField,
  isPublishing,
  onConfirm,
}: {
  step: Extract<PublishStep, { kind: "drops" }>;
  unitsByField: Record<string, MeasurementUnit>;
  isPublishing: boolean;
  onConfirm: Props["onConfirm"];
}) {
  const t = useTranslations("FormsPage.publish");
  const format = useAnswerFormat();

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("dropsTitle")}</AlertDialogTitle>
        <AlertDialogDescription>{t("dropsDescription")}</AlertDialogDescription>
      </AlertDialogHeader>

      <ul className="flex max-h-64 flex-col divide-y overflow-y-auto rounded-lg border text-sm">
        {step.dropped.map((drop) => {
          const unit = unitsByField[drop.fieldId];
          const limits = unit ? format.limits(drop.limits, unit) : null;
          return (
            <li
              key={`${drop.templateId}:${drop.targetId}:${drop.fieldId}`}
              className="flex flex-col gap-0.5 px-3 py-2"
            >
              <span className="font-medium">{drop.targetName}</span>
              <span className="text-muted-foreground">
                {t("dropLine", {
                  field: drop.fieldLabel,
                  location: drop.locationName,
                  limits: limits ?? t("noLimits"),
                })}
              </span>
            </li>
          );
        })}
      </ul>

      <AlertDialogFooter>
        <AlertDialogCancel disabled={isPublishing}>{t("cancel")}</AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          isLoading={isPublishing}
          onClick={() => onConfirm(step)}
        >
          <TriangleAlertIcon data-icon="inline-start" />
          {t("confirmDrops")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
