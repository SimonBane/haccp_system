"use client";

import { FORM_CATEGORY, RECORD_RESULT } from "@haccp/shared";
import {
  CheckIcon,
  CircleAlertIcon,
  PencilIcon,
  RotateCcwIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { ResponsiveFormDialog } from "@/components/ui/responsive-form-dialog";
import { AnswerList } from "@/features/forms/components/answer-list";
import { useOrgTimeZone } from "@/features/tenant/use-org-timezone";
import { formatTimeOfDay } from "../lib/format";
import { needsRecordFlow } from "../lib/today-round";
import type { TodayTimelineItem } from "../lib/today-timeline";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TodayTimelineItem;
  currentUserId: string | null;
  isUndoing: boolean;
  onUndo: (item: TodayTimelineItem) => void;
  onEdit: (item: TodayTimelineItem) => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  );
}

/** Undo lives here so a mis-tap on the row cannot delete a compliance record. */
export function TodayRecordSheet({
  open,
  onOpenChange,
  item,
  currentUserId,
  isUndoing,
  onUndo,
  onEdit,
}: Props) {
  const t = useTranslations("TodayPage");
  const tForms = useTranslations("Forms");
  const locale = useLocale();
  const timeZone = useOrgTimeZone();
  const { task, form, isDeviation } = item;
  const canEdit = needsRecordFlow(item);
  const isJudged =
    task.result === RECORD_RESULT.PASS || task.result === RECORD_RESULT.FAIL;

  const userLabel = task.completedBy
    ? task.completedBy.id === currentUserId
      ? t("audit.you")
      : [task.completedBy.firstName, task.completedBy.lastName]
          .filter(Boolean)
          .join(" ") || task.completedBy.id.slice(-6)
    : "—";

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={task.title}
      description={
        <>
          {task.targetName ? `${task.targetName} · ` : ""}
          {task.scheduledTime}
        </>
      }
      closeLabel={t("record.close")}
      footer={
        // flex-row overrides the base flex-col-reverse: this footer is always a
        // 50/50 row, not just from sm: up.
        <DialogFooter className="flex-row items-center gap-2 md:gap-3">
          <Button
            variant="outline"
            className="min-h-14 flex-1 rounded-2xl md:min-h-10 md:rounded-md"
            onClick={() => onOpenChange(false)}
          >
            {t("record.close")}
          </Button>
          {canEdit ? (
            <Button
              variant="secondary"
              className="min-h-14 flex-1 rounded-2xl md:min-h-10 md:rounded-md"
              onClick={() => onEdit(item)}
            >
              <PencilIcon />
              {t("actions.edit")}
            </Button>
          ) : null}
          <Button
            variant="destructive"
            className="min-h-14 flex-1 rounded-2xl md:min-h-10 md:rounded-md"
            isLoading={isUndoing}
            onClick={() => onUndo(item)}
          >
            <RotateCcwIcon />
            {t("actions.undo")}
          </Button>
        </DialogFooter>
      }
    >
      <div className="space-y-4">
        {isJudged ? (
          <div className="flex justify-center">
            <Badge variant={isDeviation ? "destructive" : "success"}>
              {isDeviation ? <CircleAlertIcon /> : <CheckIcon />}
              {isDeviation ? t("record.fail") : t("record.pass")}
            </Badge>
          </div>
        ) : null}

        {task.values ? (
          <AnswerList
            definition={form?.definition ?? null}
            values={task.values}
            className="rounded-xl border px-3"
          />
        ) : null}

        <div className="divide-y">
          <DetailRow
            label={t("record.completedAt")}
            value={
              task.completedAt
                ? formatTimeOfDay(task.completedAt, locale, timeZone)
                : "—"
            }
          />
          <DetailRow label={t("record.completedBy")} value={userLabel} />
          <DetailRow
            label={t("record.category")}
            value={tForms(`categories.${form?.category ?? FORM_CATEGORY.OTHER}`)}
          />
        </div>

        {task.correctiveAction ? (
          <div className="rounded-lg bg-destructive/[0.06] p-3">
            <p className="text-sm font-medium">{t("audit.correctiveAction")}</p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
              {task.correctiveAction}
            </p>
          </div>
        ) : null}
      </div>
    </ResponsiveFormDialog>
  );
}
