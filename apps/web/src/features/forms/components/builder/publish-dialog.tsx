"use client";

import type { DroppedOverride, MeasurementUnit } from "@haccp/shared";
import { SendIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAnswerFormat } from "../../hooks/use-answer-format";

export type PublishStep =
  | { kind: "confirm"; nextVersion: number }
  | { kind: "drops"; nextVersion: number; dropped: DroppedOverride[] };

type Props = {
  step: PublishStep | null;
  /** Units the dropped overrides were set in, by field id, so their limits read correctly. */
  unitsByField: Record<string, MeasurementUnit>;
  isPublishing: boolean;
  onCancel: () => void;
  onConfirm: (step: PublishStep) => void;
};

export function PublishDialog({
  step,
  unitsByField,
  isPublishing,
  onCancel,
  onConfirm,
}: Props) {
  const t = useTranslations("FormsPage.publish");
  const format = useAnswerFormat();

  const isDrops = step?.kind === "drops";

  return (
    <AlertDialog
      open={step !== null}
      onOpenChange={(open) => {
        if (!open && !isPublishing) onCancel();
      }}
    >
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isDrops
              ? t("dropsTitle")
              : t("title", { version: step?.nextVersion ?? 0 })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isDrops ? t("dropsDescription") : t("description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {step?.kind === "drops" ? (
          <ul className="flex max-h-64 flex-col divide-y overflow-y-auto rounded-lg border text-sm">
            {step.dropped.map((drop) => {
              const unit = unitsByField[drop.fieldId];
              const limits = unit ? format.limits(drop.limits, unit) : null;
              return (
                <li
                  key={`${drop.templateId}:${drop.targetId}:${drop.fieldId}`}
                  className="flex flex-col gap-0.5 px-3 py-2"
                >
                  <span className="font-medium">
                    {drop.templateTitle} · {drop.targetName}
                  </span>
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
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPublishing}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={isDrops ? "destructive" : "default"}
            isLoading={isPublishing}
            onClick={() => {
              if (step) onConfirm(step);
            }}
          >
            {isDrops ? (
              <TriangleAlertIcon data-icon="inline-start" />
            ) : (
              <SendIcon data-icon="inline-start" />
            )}
            {isDrops ? t("confirmDrops") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
