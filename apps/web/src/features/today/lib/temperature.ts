/**
 * Accepts both decimal separators so a Bulgarian keypad entry ("3,8") and a
 * hardware keyboard entry ("3.8") parse identically.
 */
export function parseLocalizedTemperature(value: string): number {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  return normalized.length > 0 ? Number(normalized) : Number.NaN;
}

const PRESET_DELIMITER = ", ";

function splitCorrectiveAction(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function hasCorrectiveActionPreset(
  value: string,
  preset: string,
): boolean {
  return splitCorrectiveAction(value).some(
    (part) => part.toLowerCase() === preset.toLowerCase(),
  );
}

/** Chips append to, and remove from, the same free-text field the API stores. */
export function toggleCorrectiveActionPreset(
  value: string,
  preset: string,
): string {
  const parts = splitCorrectiveAction(value);
  const index = parts.findIndex(
    (part) => part.toLowerCase() === preset.toLowerCase(),
  );

  if (index >= 0) {
    parts.splice(index, 1);
  } else {
    parts.push(preset);
  }

  return parts.join(PRESET_DELIMITER);
}
