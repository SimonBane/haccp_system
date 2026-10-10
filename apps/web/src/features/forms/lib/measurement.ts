import {
  MEASUREMENT_UNITS,
  measurementFails,
  type MeasurementLimits,
  type MeasurementUnit,
} from "@haccp/shared";

export type MeasurementSign = 1 | -1;

export type MeasurementVerdict = "pass" | "fail";

export function unitAllowsNegative(unit: MeasurementUnit): boolean {
  return MEASUREMENT_UNITS[unit].min < 0;
}

export function unitDecimals(unit: MeasurementUnit): number {
  return MEASUREMENT_UNITS[unit].decimals;
}

function unitIntegerDigits(unit: MeasurementUnit): number {
  const spec = MEASUREMENT_UNITS[unit];
  return String(Math.trunc(Math.max(Math.abs(spec.min), Math.abs(spec.max))))
    .length;
}

/**
 * Coerce input into a legal draft rather than rejecting it (a paste of "−19,2"
 * otherwise does nothing). The result can never hold an exponent or Infinity.
 */
export function sanitizeMeasurementDraft(
  raw: string,
  separator: string,
  unit: MeasurementUnit,
): string {
  const maxIntegerDigits = unitIntegerDigits(unit);
  const maxFractionDigits = unitDecimals(unit);
  const unified = raw.replace(/[−–—]/g, "-").replace(/[^0-9\-.,]/g, "");

  const negative = unitAllowsNegative(unit) && unified.startsWith("-");
  const digitsAndSeparators = unified.replace(/-/g, "");

  let seenSeparator = false;
  let integerPart = "";
  let fractionPart = "";

  for (const character of digitsAndSeparators) {
    if (character === "." || character === ",") {
      if (seenSeparator || maxFractionDigits === 0) continue;
      seenSeparator = true;
      continue;
    }

    if (seenSeparator) {
      if (fractionPart.length < maxFractionDigits) fractionPart += character;
      continue;
    }

    if (integerPart.length < maxIntegerDigits) integerPart += character;
  }

  // "08" is a mistype; "0,5" is a real reading — only strip a leading zero when another digit follows.
  if (integerPart.length > 1 && integerPart.startsWith("0")) {
    integerPart = integerPart.replace(/^0+(?=\d)/, "");
  }

  const body = seenSeparator
    ? `${integerPart}${separator}${fractionPart}`
    : integerPart;
  if (body === "") return negative ? "-" : "";

  return negative ? `-${body}` : body;
}

/** Finite value for a complete draft; null while still being typed ("", "-", "0,"). */
export function parseMeasurementDraft(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed + 0 : null;
}

export function formatMeasurementDraft(
  value: number,
  separator: string,
  unit: MeasurementUnit,
): string {
  const scale = 10 ** unitDecimals(unit);
  const rounded = Math.round(value * scale) / scale;
  return String(rounded).replace(".", separator);
}

/** Rebuild the draft from sign (survives an empty field) and digits. */
export function composeSignedDraft(
  sign: MeasurementSign,
  digits: string,
): string {
  if (digits === "") return "";
  return sign < 0 ? `-${digits}` : digits;
}

/** Sign a fresh reading most likely carries; only a band entirely below zero starts negative. */
export function inferMeasurementSign(
  limits: MeasurementLimits,
  unit: MeasurementUnit,
): MeasurementSign {
  if (!unitAllowsNegative(unit)) return 1;

  const { min, max } = limits;
  if (max !== null && max < 0) return -1;
  if (min === null || max === null || min >= 0 || min > max) return 1;
  return Math.abs(min) > Math.abs(max) ? -1 : 1;
}

/** Null when there is nothing to judge: no value yet, or no limits to judge it against. */
export function measurementVerdict(
  value: number | null,
  limits: MeasurementLimits,
): MeasurementVerdict | null {
  if (value === null) return null;
  if (limits.min === null && limits.max === null) return null;
  return measurementFails(value, limits) ? "fail" : "pass";
}

export function hasLimits(limits: MeasurementLimits): boolean {
  return limits.min !== null || limits.max !== null;
}

export function formatMeasurementNumber(
  value: number,
  unit: MeasurementUnit,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: unitDecimals(unit),
  }).format(value);
}

/** "0 – 4 °C", "≥ 63 °C" or "≤ 24 %"; null when the field has no limits. */
export function formatLimits(
  limits: MeasurementLimits,
  unit: MeasurementUnit,
  locale: string,
  symbol: string,
): string | null {
  const format = (value: number) =>
    formatMeasurementNumber(value, unit, locale);

  if (limits.min !== null && limits.max !== null) {
    return `${format(limits.min)} – ${format(limits.max)} ${symbol}`;
  }
  if (limits.min !== null) return `≥ ${format(limits.min)} ${symbol}`;
  if (limits.max !== null) return `≤ ${format(limits.max)} ${symbol}`;
  return null;
}

export function decimalSeparator(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
  return parts.find((part) => part.type === "decimal")?.value ?? ".";
}
