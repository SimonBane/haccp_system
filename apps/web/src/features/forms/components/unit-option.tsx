"use client";

import {
  parameterUnit,
  type MeasurementParameter,
  type MeasurementUnit,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import { FIELD_TYPE_ICONS, MEASUREMENT_UNIT_ICONS } from "../lib/category-icon";

/** The unit's icon, or the measurement gauge when a range spans several units. */
export function UnitIcon({
  unit,
  className,
}: {
  unit: MeasurementUnit | null;
  className?: string;
}) {
  const Icon = unit
    ? MEASUREMENT_UNIT_ICONS[unit]
    : FIELD_TYPE_ICONS.measurement;
  return <Icon className={className} aria-hidden />;
}

/** What a field measures, with its unit's icon and symbol, for the measurement pickers' items and their closed trigger alike. */
export function ParameterOption({
  parameter,
}: {
  parameter: MeasurementParameter;
}) {
  const t = useTranslations("Forms");
  const unit = parameterUnit(parameter);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <UnitIcon unit={unit} className="size-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{t(`parameters.${parameter}`)}</span>
      <span className="shrink-0 text-muted-foreground">
        {t(`units.${unit}.symbol`)}
      </span>
    </span>
  );
}
