import { EQUIPMENT_TEMP_MAX_C, EQUIPMENT_TEMP_MIN_C } from "@haccp/shared";
import type { TemperatureResult } from "@haccp/shared";

export const TEMP_MAX_INT_DIGITS = 2;
export const TEMP_MAX_FRACTION_DIGITS = 1;

export const TEMP_MAX_MAGNITUDE = 99.9;

const PRESET_DELIMITER = ", ";

/** The pass/fail verdict is the domain `TemperatureResult` — aliased so this feature's UI code reads naturally. */
export type TemperatureVerdict = TemperatureResult;

export const CORRECTIVE_PRESET_KEYS = [
  "movedProduct",
  "adjustedThermostat",
  "notifiedManager",
  "calledService",
] as const;

export type CorrectivePresetKey = (typeof CORRECTIVE_PRESET_KEYS)[number];

/** Headroom for presets inside the API's 1000-character field. */
export const NOTES_MAX_LENGTH = 900;

/**
 * Coerce input into a legal draft rather than rejecting it (a paste of "−19,2"
 * otherwise does nothing). The result can never hold an exponent or Infinity.
 */
export function sanitizeTemperatureDraft(raw: string, separator: string): string {
  const unified = raw
    .replace(/[−–—]/g, "-")
    .replace(/[^0-9\-.,]/g, "");

  const negative = unified.startsWith("-");
  const digitsAndSeparators = unified.replace(/-/g, "");

  let seenSeparator = false;
  let integerPart = "";
  let fractionPart = "";

  for (const character of digitsAndSeparators) {
    if (character === "." || character === ",") {
      if (seenSeparator) continue;
      seenSeparator = true;
      continue;
    }

    if (seenSeparator) {
      if (fractionPart.length < TEMP_MAX_FRACTION_DIGITS) fractionPart += character;
      continue;
    }

    if (integerPart.length < TEMP_MAX_INT_DIGITS) integerPart += character;
  }

  // "08" is a mistype; "0,5" is a real reading — only strip a leading zero when another digit follows.
  if (integerPart.length > 1 && integerPart.startsWith("0")) {
    integerPart = integerPart.replace(/^0+(?=\d)/, "");
  }

  const body = seenSeparator ? `${integerPart}${separator}${fractionPart}` : integerPart;
  if (body === "") return negative ? "-" : "";

  return negative ? `-${body}` : body;
}

/** Finite value for a complete draft; null while still being typed ("", "-", "0,"). */
export function parseTemperatureDraft(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatTemperatureDraft(value: number, separator: string): string {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded).replace(".", separator);
}

/** Sign a fresh reading most likely carries; a band centred on zero resolves positive. */
export function inferTemperatureSign(minTempC: number, maxTempC: number): 1 | -1 {
  if (
    !Number.isFinite(minTempC) ||
    !Number.isFinite(maxTempC) ||
    minTempC > maxTempC
  ) {
    return 1;
  }

  if (maxTempC < 0) return -1;
  if (minTempC >= 0) return 1;
  return Math.abs(minTempC) > Math.abs(maxTempC) ? -1 : 1;
}

/** Rebuild the draft from sign (survives an empty field) and digits. */
export function composeSignedDraft(sign: 1 | -1, digits: string): string {
  if (digits === "") return "";
  return sign < 0 ? `-${digits}` : digits;
}

/** Hint only — a failed freezer can read +20 °C, so this must never block or clamp. */
export function temperaturePlausibility(value: number): "ok" | "below" | "above" {
  if (value < EQUIPMENT_TEMP_MIN_C) return "below";
  if (value > EQUIPMENT_TEMP_MAX_C) return "above";
  return "ok";
}

export function composeCorrectiveAction(
  presetLabels: string[],
  notes: string,
): string {
  const trimmedNotes = notes.trim();
  const parts = [...presetLabels];
  if (trimmedNotes) parts.push(trimmedNotes);
  return parts.join(PRESET_DELIMITER);
}
