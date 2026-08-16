"use client";

import { classifyTemperatureResult } from "@haccp/shared";
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
  /** Stable identity of the check on screen; changing it starts a fresh entry. */
  occurrenceKey: string;
  minTempC: number;
  maxTempC: number;
  position: number;
  size: number;
};

type Props = {
  /** Stays mounted while false so the sheet can slide in and out. */
  open: boolean;
  /**
   * Null before any check has been opened. The component still mounts then, so
   * the sheet exists in its closed state and the first open has something to
   * transition from — the admin forms are mounted the same way.
   */
  check: TemperatureCheck | null;
  onSubmit: (recordedC: number, correctiveAction?: string) => Promise<boolean>;
  onSkip: () => void;
  onClose: () => void;
};

/**
 * One check inside a round: picks the primary action, gates the deviation step,
 * and hands the surface its header and action bar.
 *
 * The shell around it stays mounted for the whole round, so advancing swaps the
 * contents rather than replaying the sheet's slide-up.
 */
export function TemperatureRoundFlow({
  open,
  check,
  onSubmit,
  onSkip,
  onClose,
}: Props) {
  const t = useTranslations("TodayPage");
  const timeZone = useOrgTimeZone();

  // Placeholders while there is no check: the hooks below run on every render,
  // and nothing they produce is shown until `check` is real.
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

  // Marking the outgoing step inert evicts whatever held focus, and the browser
  // hands it to the next control it finds — the notes textarea, which opens the
  // phone keyboard over the corrective options nobody asked to skip. Land on the
  // step itself instead, so the keyboard only appears once notes are tapped.
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

  // Advancing to the next check has to move focus too, or the keyboard lands
  // nowhere and a screen reader never learns the equipment changed. Skipped on
  // first open, where the shell's initialFocus already handles it.
  //
  // Advancing is itself a tap, and the keyboard is already up from the previous
  // check, so moving focus between two inputs keeps it there — no priming.
  useEffect(() => {
    if (!hasAdvanced.current) {
      hasAdvanced.current = true;
      return;
    }
    const input = readingInputRef.current;
    if (input) {
      input.focus();
      // Selecting means an immediate retype overwrites instead of appending.
      input.select();
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
    }) === "out_of_range";

  // Always the plain "Save" — a "· next" suffix read as a promise that the
  // round pauses to show what got saved, which it deliberately does not; the
  // round counter is what already says another check is coming.
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
      {/* Both steps share one grid cell on a phone so neither can resize the
          other while the worker types. On desktop the inactive step is hidden
          so the dialog fits whichever step is showing. */}
      {/* min-w-0 throughout: a grid item defaults to min-width:auto, so without
          it the deviation step's preset columns floor the whole dialog at their
          min-content width and push the content out past the edge. */}
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
