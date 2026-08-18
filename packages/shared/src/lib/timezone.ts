export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** The single shared IANA timezone validator — reused by schemas and, later, the materializer. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = partsFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  partsFormatterCache.set(timeZone, formatter);
  return formatter;
}

export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const parts: Record<string, string> = {};
  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    parts[part.type] = part.value;
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

export function zonedDateString(instant: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function zonedMinutesOfDay(instant: Date, timeZone: string): number {
  const { hour, minute } = zonedParts(instant, timeZone);
  return hour * 60 + minute;
}

/** Offset from wall-clock parts, not `shortOffset` strings (Kathmandu +05:45; London "GMT" has no digits). */
export function zoneOffsetMinutes(timeZone: string, instant: Date): number {
  const { year, month, day, hour, minute, second } = zonedParts(
    instant,
    timeZone,
  );
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const instantSeconds = Math.floor(instant.getTime() / 1000) * 1000;

  return Math.round((wallClockAsUtc - instantSeconds) / 60_000);
}

/** Two-pass DST: first offset can sit on the wrong side of a transition. Gap → after the jump; overlap → second occurrence. */
export function wallClockToInstant(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = zoneOffsetMinutes(timeZone, new Date(naive));
  const candidate = naive - firstOffset * 60_000;

  const secondOffset = zoneOffsetMinutes(timeZone, new Date(candidate));
  if (secondOffset === firstOffset) {
    return new Date(candidate);
  }

  return new Date(naive - secondOffset * 60_000);
}
