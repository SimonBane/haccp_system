/**
 * IANA timezone helpers built on `Intl` alone — no date library.
 *
 * The organisation's timezone is the only zone that means anything in this
 * product: a scheduled time like "07:00" is a wall clock at the site, and the
 * server, the phone and the site can all be in different zones.
 *
 * Offsets are derived by formatting the instant in the target zone and diffing
 * the resulting wall clock against the instant itself. That is more robust than
 * parsing `timeZoneName: "shortOffset"` strings, which have to cope with
 * three-quarter-hour zones (Asia/Kathmandu +05:45) and with London rendering a
 * bare "GMT" that carries no digits at all.
 */

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/**
 * `organizations.timezone` is a free-text column and the settings picker falls
 * back to a plain input when `Intl.supportedValuesOf` is unavailable, so a
 * corrupt value is reachable. `Intl` throws `RangeError` on those, which would
 * take the whole page down — fall back to the runtime's own zone instead.
 */
function safeTimeZone(timeZone: string): string | undefined {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return undefined;
  }
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = partsFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
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

/** The wall-clock parts of an instant, as read in `timeZone`. */
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

/** Calendar date, "YYYY-MM-DD", of an instant as read in `timeZone`. */
export function zonedDateString(instant: Date, timeZone: string): string {
  const { year, month, day } = zonedParts(instant, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Minutes since midnight (0–1439) of an instant as read in `timeZone`. */
export function zonedMinutesOfDay(instant: Date, timeZone: string): number {
  const { hour, minute } = zonedParts(instant, timeZone);
  return hour * 60 + minute;
}

/** Signed offset from UTC, in minutes, that `timeZone` is at during `instant`. */
export function zoneOffsetMinutes(timeZone: string, instant: Date): number {
  const { year, month, day, hour, minute, second } = zonedParts(
    instant,
    timeZone,
  );
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const instantSeconds = Math.floor(instant.getTime() / 1000) * 1000;

  return Math.round((wallClockAsUtc - instantSeconds) / 60_000);
}

/**
 * The instant at which a wall clock occurs in `timeZone` — the inverse of
 * `zonedDateString` + `zonedMinutesOfDay`.
 *
 * Two passes are required. The first offset is sampled at the naive
 * wall-clock-treated-as-UTC instant, which can sit on the wrong side of a DST
 * transition; the second re-samples at the candidate instant and corrects.
 *
 * Around a transition the wall clock is either missing or repeated, so the
 * result is defined rather than exact: a time inside a spring-forward gap
 * resolves to the instant just after the jump, and a repeated autumn time
 * resolves to its second occurrence. Only reachable by a task scheduled at the
 * exact transition minute, on two Sundays a year.
 */
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
