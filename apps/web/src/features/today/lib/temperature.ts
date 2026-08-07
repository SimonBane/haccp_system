import { EQUIPMENT_TEMP_MAX_C, EQUIPMENT_TEMP_MIN_C } from "@haccp/shared";

/**
 * A reading is at most two integer digits and one decimal — the same grammar the
 * equipment form enforces on min/max. Anything wider is a typo, not a fridge.
 */
export const TEMP_MAX_INT_DIGITS = 2;
export const TEMP_MAX_FRACTION_DIGITS = 1;

/** Largest magnitude the grammar can express, and the schema's hard bound. */
export const TEMP_MAX_MAGNITUDE = 99.9;

const PRESET_DELIMITER = ", ";

export type TemperatureVerdict = "ok" | "out_of_range";

/**
 * Coerces anything — keystrokes, pastes, autofill — into the nearest legal draft
 * rather than rejecting it. The equipment form drops invalid input on the floor,
 * which leaves a paste of "−19,2" (Unicode minus) doing nothing at all with no
 * explanation. Coercing always lands somewhere the worker can see and correct.
 *
 * Because the result can never hold an exponent, a hex prefix or "Infinity",
 * every downstream `Number()` is safe by construction.
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

  // "08" is a mistyped "8"; "0,5" is a real reading, so only strip the zero when
  // another integer digit follows it.
  if (integerPart.length > 1 && integerPart.startsWith("0")) {
    integerPart = integerPart.replace(/^0+(?=\d)/, "");
  }

  const body = seenSeparator ? `${integerPart}${separator}${fractionPart}` : integerPart;
  if (body === "") return negative ? "-" : "";

  return negative ? `-${body}` : body;
}

/**
 * Finite value for a complete draft, null while it is still being typed
 * ("", "-", "0,") or otherwise unusable.
 */
export function parseTemperatureDraft(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Number back to a draft in the active locale — -19.2 becomes "-19,2" in bg. */
export function formatTemperatureDraft(value: number, separator: string): string {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded).replace(".", separator);
}

/**
 * Which sign a fresh reading for this equipment most likely carries, so a
 * freezer worker taps "1" then "8" and gets -18 without hunting for a minus.
 *
 * A band that straddles zero goes to whichever side owns more of it; a tie
 * (-2…+2) resolves positive, because a band centred on zero is a chilled unit
 * whose everyday reading is above it.
 */
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

/**
 * Rebuilds the canonical draft from the two things the mobile control tracks
 * separately: the sign (which survives an empty field) and the digits.
 */
export function composeSignedDraft(sign: 1 | -1, digits: string): string {
  if (digits === "") return "";
  return sign < 0 ? `-${digits}` : digits;
}

/**
 * Flags readings outside what any monitored unit can physically be, as a hint
 * only. A failed freezer really can read +20 °C and recording that is the entire
 * point of the log, so this must never block or clamp the value.
 */
export function temperaturePlausibility(value: number): "ok" | "below" | "above" {
  if (value < EQUIPMENT_TEMP_MIN_C) return "below";
  if (value > EQUIPMENT_TEMP_MAX_C) return "above";
  return "ok";
}

/**
 * Presets and free text are separate fields in the form but a single string on
 * the wire, which is what the record sheet and the task row already render.
 */
export function composeCorrectiveAction(
  presetLabels: string[],
  notes: string,
): string {
  const trimmedNotes = notes.trim();
  const parts = [...presetLabels];
  if (trimmedNotes) parts.push(trimmedNotes);
  return parts.join(PRESET_DELIMITER);
}
