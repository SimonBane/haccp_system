"use client";

import { classifyTemperatureResult, TEMPERATURE_RESULT } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { useOrgTimeZone } from "@/features/tenant/use-org-timezone";
import { cn } from "@/lib/utils";
import { useTemperatureEntry } from "../hooks/use-temperature-entry";
import type { TodayTimelineItem } from "../lib/today-timeline";
import { TemperatureCorrectiveStep } from "./temperature-corrective-step";
import { TemperatureEntryShell } from "./temperature-entry-shell";
import { TemperatureReadingStep } from "./temperature-reading-step";
import { TemperatureRoundFooter } from "./temperature-round-footer";

const ID_PREFIX = "temperature-check";

export type TemperatureCheck = {
  item: TodayTimelineItem;
  occurrenceKey: string;
  minTempC: number;
  maxTempC: number;
  position: number;
  size: number;
};

type Props = {
  /** Kept mounted while false so the exit transition can run. */
  open: boolean;
  /** Null until a check is opened; still mounted so the first open can transition. */
  check: TemperatureCheck | null;
  onSubmit: (recordedC: number, correctiveAction?: string) => Promise<boolean>;
  onSkip: () => void;
  onClose: () => void;
};

export function TemperatureRoundFlow({
  open,
  check,
  onSubmit,
  onSkip,
  onClose,
}: Props) {
  const t = useTranslations("TodayPage");
  const timeZone = useOrgTimeZone();

  // Hooks must run every render; placeholders are unused until `check` is set.
  const item = check?.item ?? null;
  const occurrenceKey = check?.occurrenceKey ?? "";
  const minTempC = check?.minTempC ?? 0;
  const maxTempC = check?.maxTempC ?? 0;
  const position = check?.position ?? 1;
  const size = check?.size ?? 1;

  const readingInputRef = useRef<HTMLInputElement>(null);
  const readingStepRef = useRef<HTMLDivElement>(null);
  const correctiveStepRef = useRef<HTMLDivElement>(null);
  const hasChangedStep = useRef(false);
  const hasAdvanced = useRef(false);

  const entry = useTemperatureEntry({
    occurrenceKey,
    minTempC,
    maxTempC,
    onSubmit,
  });

  const verdict =
    entry.parsed === null
      ? null
      : classifyTemperatureResult({
          recordedC: entry.parsed,
          minTempC,
          maxTempC,
        });

  const isReading = entry.step === "reading";
  const isRound = size > 1;

  // Focus the step, not the notes textarea — otherwise the phone keyboard covers the options.
  useEffect(() => {
    if (!hasChangedStep.current) {
      hasChangedStep.current = true;
      return;
    }
    const target = isReading
      ? readingStepRef.current
      : correctiveStepRef.current;
    target?.focus();
  }, [isReading]);

  // Move focus on advance so the keyboard and screen reader follow; skipped on first open.
  useEffect(() => {
    if (!hasAdvanced.current) {
      hasAdvanced.current = true;
      return;
    }
    const input = readingInputRef.current;
    if (input) {
      input.focus();
      input.select(); // Retype overwrites instead of appending.
      return;
    }
    readingStepRef.current?.focus();
  }, [occurrenceKey]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && entry.isSubmitting) return;
    if (!nextOpen) onClose();
  }

  const isDeviationAhead =
    entry.parsed !== null &&
    classifyTemperatureResult({
      recordedC: entry.parsed,
      minTempC,
      maxTempC,
    }) === TEMPERATURE_RESULT.OUT_OF_RANGE;

  const primaryIcon = isReading && isDeviationAhead ? "continue" : "confirm";
  const primaryLabel = (() => {
    if (isReading && isDeviationAhead)
      return t("temperatureDialog.continueLabel");
    if (!isReading) return t("temperatureDialog.saveDeviation");
    return t("temperatureDialog.confirm");
  })();

  return (
    <TemperatureEntryShell
      open={open}
      onOpenChange={handleOpenChange}
      title={item ? (item.task.equipmentName ?? item.task.title) : ""}
      subtitle={
        item
          ? item.task.equipmentName
            ? `${item.task.title} · ${item.task.scheduledTime}`
            : item.task.scheduledTime
          : ""
      }
      leading={isReading ? "close" : "back"}
      leadingLabel={
        isReading ? t("temperatureDialog.close") : t("temperatureDialog.back")
      }
      onLeading={() => (isReading ? onClose() : entry.goToReading())}
      round={isRound ? { position, size } : null}
      initialFocus={readingInputRef}
      footer={
        <TemperatureRoundFooter
          primaryIcon={primaryIcon}
          primaryLabel={primaryLabel}
          primaryDisabled={entry.parsed === null}
          primaryLoading={entry.isSubmitting}
          onPrimary={() => void entry.pressPrimary()}
          canSkip={isRound && isReading}
          skipLabel={t("temperatureDialog.skipLabel", {
            title: item ? (item.task.equipmentName ?? item.task.title) : "",
          })}
          onSkip={onSkip}
          showBack={!isReading}
          backLabel={t("temperatureDialog.back")}
          onBack={entry.goToReading}
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
          ref={readingStepRef}
          tabIndex={-1}
          className={cn(
            "col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col outline-none transition-opacity duration-150 motion-reduce:transition-none",
            isReading ? "opacity-100" : "pointer-events-none opacity-0 md:hidden",
          )}
          inert={!isReading}
        >
          <TemperatureReadingStep
            idPrefix={ID_PREFIX}
            minTempC={minTempC}
            maxTempC={maxTempC}
            digits={entry.digits}
            sign={entry.sign}
            parsed={entry.parsed}
            separator={entry.separator}
            onSignChange={entry.changeSign}
            onDigitsChange={entry.changeDigits}
            onDraftChange={entry.changeDraft}
            error={entry.readingError}
            verdict={verdict}
            settledValue={entry.parsed}
            priorReading={item?.priorReading ?? null}
            timeZone={timeZone}
            inputRef={readingInputRef}
          />
        </div>

        <div
          ref={correctiveStepRef}
          tabIndex={-1}
          className={cn(
            "col-start-1 row-start-1 flex min-h-0 min-w-0 flex-col outline-none transition-opacity duration-150 motion-reduce:transition-none",
            "overflow-y-auto overscroll-contain px-1.5 py-1 -mx-1.5",
            isReading ? "pointer-events-none opacity-0 md:hidden" : "opacity-100",
          )}
          inert={isReading}
        >
          <TemperatureCorrectiveStep
            idPrefix={ID_PREFIX}
            recordedC={entry.parsed}
            minTempC={minTempC}
            maxTempC={maxTempC}
            presets={entry.presets}
            onTogglePreset={entry.togglePreset}
            presetsError={entry.correctiveError}
            notes={entry.notes}
            onNotesChange={entry.setNotes}
            notesError={entry.notesError}
          />
        </div>
      </form>
    </TemperatureEntryShell>
  );
}
