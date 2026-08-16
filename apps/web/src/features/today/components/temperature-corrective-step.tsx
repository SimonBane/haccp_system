"use client";

import { CheckIcon, CircleAlertIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import {
  CORRECTIVE_PRESET_KEYS,
  NOTES_MAX_LENGTH,
  type CorrectivePresetKey,
} from "../lib/temperature";

type Props = {
  idPrefix: string;
  recordedC: number | null;
  minTempC: number;
  maxTempC: number;
  presets: readonly CorrectivePresetKey[];
  onTogglePreset: (key: CorrectivePresetKey) => void;
  presetsError?: string | null;
  notes: string;
  onNotesChange: (next: string) => void;
  notesError?: string | null;
  className?: string;
};

/** Separate step: unfolding below the reading shoved the form while typing "-1" on the way to "-18". */
export function TemperatureCorrectiveStep({
  idPrefix,
  recordedC,
  minTempC,
  maxTempC,
  presets,
  onTogglePreset,
  presetsError,
  notes,
  onNotesChange,
  notesError,
  className,
}: Props) {
  const t = useTranslations("TodayPage");
  const locale = useLocale();

  const notesId = `${idPrefix}-notes`;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
      <div className="flex shrink-0 flex-col items-center gap-1 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <CircleAlertIcon className="size-5 text-destructive" aria-hidden />
          <span className="text-2xl font-semibold tabular-nums">
            {recordedC === null
              ? "—"
              : `${formatTemperature(recordedC, locale)} °C`}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("temperatureDialog.allowedRange")}{" "}
          <span className="tabular-nums">
            {t("temperatureDialog.rangeInline", {
              min: formatTemperature(minTempC, locale),
              max: formatTemperature(maxTempC, locale),
            })}
          </span>
        </span>
      </div>

      <Field data-invalid={Boolean(presetsError)} className="shrink-0">
        <FieldTitle>{t("temperatureDialog.correctiveTitle")}</FieldTitle>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {CORRECTIVE_PRESET_KEYS.map((key) => {
            const active = presets.includes(key);
            return (
              <Button
                key={key}
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                className="relative h-auto min-h-12 w-full justify-center px-3 py-2 text-center text-sm leading-snug whitespace-normal"
                onClick={() => onTogglePreset(key)}
              >
                {active ? (
                  <CheckIcon
                    className="absolute top-1/2 left-3 size-4 -translate-y-1/2 shrink-0"
                    aria-hidden
                  />
                ) : null}
                {t(`temperatureDialog.presets.${key}`)}
              </Button>
            );
          })}
        </div>

        {presetsError ? (
          <FieldError errors={[{ message: presetsError }]} />
        ) : null}
      </Field>

      <Field
        data-invalid={Boolean(notesError)}
        className="min-h-0 flex-1 px-1"
      >
        <FieldLabel htmlFor={notesId}>
          {t("temperatureDialog.notesLabel")}
        </FieldLabel>
        <Textarea
          id={notesId}
          value={notes}
          maxLength={NOTES_MAX_LENGTH}
          aria-invalid={Boolean(notesError)}
          placeholder={t("temperatureDialog.correctiveActionPlaceholder")}
          // Shared grid cell with the reading step — a growing textarea would resize both.
          className="min-h-20 flex-1 resize-none field-sizing-fixed md:h-24 md:min-h-0 md:flex-none"
          onChange={(event) => onNotesChange(event.target.value)}
        />
        {notesError ? (
          <FieldError errors={[{ message: notesError }]} />
        ) : (
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("temperatureDialog.notesCharacterCount", {
              current: notes.length,
              max: NOTES_MAX_LENGTH,
            })}
          </p>
        )}
      </Field>
    </div>
  );
}
