"use client";

import type { MeasurementLimits, MeasurementUnit } from "@haccp/shared";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { buildAnswerFormatters } from "../lib/answer-format";
import { formatLimits } from "../lib/measurement";

/** Locale-aware unit symbols and answer text, shared by Today, Records and the form builder preview. */
export function useAnswerFormat() {
  const t = useTranslations("Forms");
  const locale = useLocale();

  return useMemo(() => {
    const symbol = (unit: MeasurementUnit) => t(`units.${unit}.symbol`);
    const answers = buildAnswerFormatters({
      locale,
      symbol,
      yes: t("answers.yes"),
      no: t("answers.no"),
    });
    const limits = (value: MeasurementLimits, unit: MeasurementUnit) =>
      formatLimits(value, unit, locale, symbol(unit));

    return {
      locale,
      symbol,
      measurement: answers.measurement,
      limits,
      answers,
    };
  }, [locale, t]);
}

export type AnswerFormat = ReturnType<typeof useAnswerFormat>;
