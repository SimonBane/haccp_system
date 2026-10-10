"use client";

import {
  FIELD_TYPE,
  type AnswersInput,
  type RecordValues,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useOrgTimeZone } from "@/features/tenant/use-org-timezone";
import { AnswerFields } from "@/features/forms/components/answer-fields";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import {
  featuredMeasurementField,
  limitsFor,
} from "@/features/forms/lib/answer-draft";
import { describeAnswers } from "@/features/forms/lib/answer-summary";
import { cn } from "@/lib/utils";
import { useRecordEntry } from "../hooks/use-record-entry";
import { correctivePresetsFor } from "../lib/corrective-action";
import { formatTimeOfDay } from "../lib/format";
import type { TodayTimelineItem } from "../lib/today-timeline";
import { CorrectiveStep } from "./corrective-step";
import { FeaturedMeasurementStep } from "./featured-measurement-step";
import { RecordEntryShell } from "./record-entry-shell";
import { RecordFlowFooter } from "./record-flow-footer";

const ID_PREFIX = "record-check";

export type RecordCheck = {
  item: TodayTimelineItem;
  occurrenceKey: string;
  position: number;
  size: number;
  /** Set when editing a saved record. */
  initialValues: RecordValues | null;
};

type Props = {
  /** Kept mounted while false so the exit transition can run. */
  open: boolean;
  /** Null until a check is opened; still mounted so the first open can transition. */
  check: RecordCheck | null;
  onSubmit: (
    values: AnswersInput,
    correctiveAction?: string,
  ) => Promise<boolean>;
  onSkip: () => void;
  onClose: () => void;
};

export function RecordFlow({ open, check, onSubmit, onSkip, onClose }: Props) {
  const t = useTranslations("TodayPage.recordDialog");
  const format = useAnswerFormat();
  const timeZone = useOrgTimeZone();

  // Hooks must run every render; placeholders are unused until `check` is set.
  const item = check?.item ?? null;
  const occurrenceKey = check?.occurrenceKey ?? "";
  const position = check?.position ?? 1;
  const size = check?.size ?? 1;
  const definition = item?.form?.definition ?? null;
  const limits = item?.task.resolvedLimits ?? {};

  const firstInputRef = useRef<HTMLInputElement>(null);
  const answersStepRef = useRef<HTMLDivElement>(null);
  const correctiveStepRef = useRef<HTMLDivElement>(null);
  const hasChangedStep = useRef(false);
  const hasAdvanced = useRef(false);

  const entry = useRecordEntry({
    occurrenceKey,
    definition,
    limits,
    initialValues: check?.initialValues ?? null,
    onSubmit,
  });

  const isAnswers = entry.step === "answers";
  const isRound = size > 1;
  const featured = definition ? featuredMeasurementField(definition) : null;

  // Focus the step, not the notes textarea — otherwise the phone keyboard covers the options.
  useEffect(() => {
    if (!hasChangedStep.current) {
      hasChangedStep.current = true;
      return;
    }
    const target = isAnswers
      ? answersStepRef.current
      : correctiveStepRef.current;
    target?.focus();
  }, [isAnswers]);

  // Move focus on advance so the keyboard and screen reader follow; skipped on first open.
  useEffect(() => {
    if (!hasAdvanced.current) {
      hasAdvanced.current = true;
      return;
    }
    const input = firstInputRef.current;
    if (input) {
      input.focus();
      input.select(); // Retype overwrites instead of appending.
      return;
    }
    answersStepRef.current?.focus();
  }, [occurrenceKey]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && entry.isSubmitting) return;
    if (!nextOpen) onClose();
  }

  const failures = definition
    ? describeAnswers(
        definition,
        entry.evaluated.values,
        format.answers,
      ).filter((line) => line.fails)
    : [];

  const primaryIcon = isAnswers && entry.isFailing ? "continue" : "confirm";
  const primaryLabel =
    isAnswers && entry.isFailing
      ? t("continue")
      : isAnswers
        ? t("save")
        : t("saveDeviation");

  const featuredEntry = featured ? entry.draft[featured.id] : undefined;
  const featuredDraft =
    featuredEntry?.type === FIELD_TYPE.MEASUREMENT ? featuredEntry : null;
  const featuredIssue = featured ? entry.issues[featured.id] : undefined;

  const prior = featured ? item?.priorRecord?.values[featured.id] : undefined;
  const priorText =
    item?.priorRecord &&
    prior?.type === FIELD_TYPE.MEASUREMENT &&
    prior.value !== null
      ? t("lastReading", {
          value: format.measurement(prior.value, prior.unit),
          time: item.priorRecord.completedAt
            ? formatTimeOfDay(
                item.priorRecord.completedAt,
                format.locale,
                timeZone,
              )
            : item.priorRecord.scheduledTime,
        })
      : null;

  const title = item ? (item.task.targetName ?? item.task.title) : "";

  return (
    <RecordEntryShell
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      subtitle={
        item
          ? item.task.targetName
            ? `${item.task.title} · ${item.task.scheduledTime}`
            : item.task.scheduledTime
          : ""
      }
      leading={isAnswers ? "close" : "back"}
      leadingLabel={isAnswers ? t("close") : t("back")}
      onLeading={() => (isAnswers ? onClose() : entry.goToAnswers())}
      round={isRound ? { position, size } : null}
      initialFocus={featured ? firstInputRef : undefined}
      footer={
        <RecordFlowFooter
          primaryIcon={primaryIcon}
          primaryLabel={primaryLabel}
          primaryDisabled={definition === null}
          primaryLoading={entry.isSubmitting}
          onPrimary={() => void entry.pressPrimary()}
          canSkip={isRound && isAnswers}
          skipLabel={t("skipLabel", { title })}
          onSkip={onSkip}
          showBack={!isAnswers}
          backLabel={t("back")}
          onBack={entry.goToAnswers}
        />
      }
    >
      {/* Shared grid cell so steps cannot resize each other; min-w-0 so preset columns cannot floor the dialog. */}
      <form
        className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-1 grid-rows-1 md:flex-none"
        onSubmit={(event) => {
          event.preventDefault();
          void entry.pressPrimary();
        }}
      >
        <div
          ref={answersStepRef}
          tabIndex={-1}
          className={cn(
            "col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col outline-none transition-opacity duration-150 motion-reduce:transition-none",
            !featured &&
              "overflow-y-auto overscroll-contain px-1.5 py-1 -mx-1.5",
            isAnswers
              ? "opacity-100"
              : "pointer-events-none opacity-0 md:hidden",
          )}
          inert={!isAnswers}
        >
          {definition && featured && featuredDraft ? (
            <FeaturedMeasurementStep
              idPrefix={ID_PREFIX}
              field={featured}
              limits={limitsFor(featured, limits)}
              draft={featuredDraft}
              separator={entry.separator}
              onChange={(next) =>
                entry.changeField(featured.id, {
                  type: FIELD_TYPE.MEASUREMENT,
                  ...next,
                })
              }
              error={
                featuredIssue
                  ? featuredIssue === "required"
                    ? t("validation.readingRequired")
                    : t("validation.readingInvalid")
                  : null
              }
              priorText={priorText}
              inputRef={firstInputRef}
            />
          ) : definition ? (
            <AnswerFields
              idPrefix={ID_PREFIX}
              definition={definition}
              limits={limits}
              draft={entry.draft}
              issues={entry.issues}
              separator={entry.separator}
              onChange={entry.changeField}
            />
          ) : null}
        </div>

        <div
          ref={correctiveStepRef}
          tabIndex={-1}
          className={cn(
            "col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col outline-none transition-opacity duration-150 motion-reduce:transition-none",
            "overflow-y-auto overscroll-contain px-1.5 py-1 -mx-1.5",
            isAnswers
              ? "pointer-events-none opacity-0 md:hidden"
              : "opacity-100",
          )}
          inert={isAnswers}
        >
          <CorrectiveStep
            idPrefix={ID_PREFIX}
            failures={failures}
            presetKeys={correctivePresetsFor(item?.form?.category ?? null)}
            presets={entry.presets}
            onTogglePreset={entry.togglePreset}
            presetsError={entry.correctiveError}
            required={entry.correctiveRequired}
            notes={entry.notes}
            onNotesChange={entry.setNotes}
            notesError={entry.notesError}
          />
        </div>
      </form>
    </RecordEntryShell>
  );
}
