"use client";

import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatTemperature } from "../lib/format";

export const CORRECTIVE_PRESET_KEYS = [
  "movedProduct",
  "adjustedThermostat",
  "notifiedManager",
  "calledService",
] as const;

export type CorrectivePresetKey = (typeof CORRECTIVE_PRESET_KEYS)[number];

/** Leaves headroom for the presets inside the API's 1000-character field. */
export const NOTES_MAX_LENGTH = 900;

/** A counter reading "900 left" over an empty box is noise, not help. */
const COUNTER_VISIBLE_FROM = 100;

type Props = {
  idPrefix: string;
  recordedC: number | null;
  presets: string[];
  onPresetsChange: (next: string[]) => void;
  presetsError?: string;
  notes: string;
  onNotesChange: (next: string) => void;
  notesError?: string;
  onNotesBlur?: () => void;
  className?: string;
};

/**
 * Step two, reached only after the worker commits an out-of-range reading.
 *
 * It is a separate step rather than a section that unfolds under the keypad:
 * typing "-1" on the way to "-18" used to make this whole block appear and push
 * the keys off the screen.
 */
export function TemperatureCorrectiveStep({
  idPrefix,
  recordedC,
  presets,
  onPresetsChange,
  presetsError,
  notes,
  onNotesChange,
  notesError,
  onNotesBlur,
  className,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();

  const notesId = `${idPrefix}-notes`;
  const remaining = NOTES_MAX_LENGTH - notes.length;

  function togglePreset(key: CorrectivePresetKey) {
    onPresetsChange(
      presets.includes(key)
        ? presets.filter((preset) => preset !== key)
        : [...presets, key],
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
      <div className="flex items-center justify-center gap-2 rounded-xl bg-destructive/[0.06] px-4 py-3 ring-1 ring-destructive/20">
        <span className="text-2xl font-semibold tabular-nums">
          {recordedC === null
            ? "—"
            : `${formatTemperature(recordedC, locale)} °C`}
        </span>
        <Badge variant="destructive">
          <CircleAlertIcon />
          {t("temperatureDialog.outOfRange")}
        </Badge>
      </div>

      <Field data-invalid={Boolean(presetsError)}>
        <FieldTitle>{t("temperatureDialog.correctiveTitle")}</FieldTitle>

        {/* Two fixed columns rather than wrapping chips: the Bulgarian labels
            are longer than the English ones and would reflow the step. */}
        <div className="grid grid-cols-2 gap-2">
          {CORRECTIVE_PRESET_KEYS.map((key) => {
            const active = presets.includes(key);
            return (
              <Button
                key={key}
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                className="h-auto min-h-11 justify-start px-3 py-2 text-left text-sm leading-snug whitespace-normal"
                onClick={() => togglePreset(key)}
              >
                {active ? <CheckIcon /> : null}
                {t(`temperatureDialog.presets.${key}`)}
              </Button>
            );
          })}
        </div>

        {presetsError ? (
          <FieldError errors={[{ message: presetsError }]} />
        ) : null}
      </Field>

      <Field data-invalid={Boolean(notesError)} className="min-h-0 flex-1">
        <FieldLabel htmlFor={notesId}>
          {t("temperatureDialog.notesLabel")}
        </FieldLabel>
        <Textarea
          id={notesId}
          value={notes}
          maxLength={NOTES_MAX_LENGTH}
          aria-invalid={Boolean(notesError)}
          placeholder={t("temperatureDialog.correctiveActionPlaceholder")}
          // Fills the phone's spare height, but never content-sized: this step
          // shares a grid cell with the reading step, and a textarea that grew
          // with its text would resize both.
          className="min-h-24 flex-1 resize-none field-sizing-fixed md:h-24 md:min-h-0 md:flex-none"
          onChange={(event) => onNotesChange(event.target.value)}
          onBlur={onNotesBlur}
        />
        {notesError ? (
          <FieldError errors={[{ message: notesError }]} />
        ) : remaining <= COUNTER_VISIBLE_FROM ? (
          <p className="text-xs text-muted-foreground">
            {t("temperatureDialog.charactersLeft", { count: remaining })}
          </p>
        ) : null}
      </Field>
    </div>
  );
}
