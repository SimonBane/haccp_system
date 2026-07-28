export type TimezoneOption = {
  value: string;
  label: string;
  values: string[];
  offsetMinutes: number;
};

const timezoneOptionsCache = new Map<string, TimezoneOption[]>();
const MAX_CITIES_PER_ROW = 6;

function getSupportedTimezoneIds(): string[] {
  if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
    return Intl.supportedValuesOf("timeZone");
  }

  return [];
}

function formatCityName(timeZone: string): string {
  const city = timeZone.split("/").pop() ?? timeZone;
  return city.replace(/_/g, " ");
}

function getOffsetMinutes(timeZone: string, date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "shortOffset",
  });

  const parts = formatter.formatToParts(date);
  const offset =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = offset.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);

  if (!match) {
    return 0;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");

  return sign * (hours * 60 + minutes);
}

function formatOffsetLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) {
    return "(UTC)";
  }

  const sign = offsetMinutes > 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;

  return `(UTC${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")})`;
}

function formatTimezoneName(timeZone: string, locale: string): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone,
      timeZoneName: "long",
    }).formatToParts(new Date());

    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

type TimezoneEntry = {
  iana: string;
  city: string;
  offsetMinutes: number;
  timezoneName: string;
};

function buildBundleLabel(offsetMinutes: number, cities: string[]): string {
  const offsetLabel = formatOffsetLabel(offsetMinutes);
  return `${offsetLabel} ${cities.join(", ")}`;
}

function chunkEntries(
  entries: TimezoneEntry[],
  maxSize: number,
): TimezoneEntry[][] {
  const sorted = [...entries].sort((left, right) =>
    left.city.localeCompare(right.city),
  );
  const chunks: TimezoneEntry[][] = [];

  for (let index = 0; index < sorted.length; index += maxSize) {
    chunks.push(sorted.slice(index, index + maxSize));
  }

  return chunks;
}

export function getTimezoneOptions(locale = "en"): TimezoneOption[] {
  const cached = timezoneOptionsCache.get(locale);
  if (cached) {
    return cached;
  }

  const bundles = new Map<string, TimezoneEntry[]>();

  for (const iana of getSupportedTimezoneIds()) {
    const entry: TimezoneEntry = {
      iana,
      city: formatCityName(iana),
      offsetMinutes: getOffsetMinutes(iana),
      timezoneName: formatTimezoneName(iana, locale),
    };
    const bundleKey = `${entry.offsetMinutes}|${entry.timezoneName}`;
    const existing = bundles.get(bundleKey) ?? [];
    existing.push(entry);
    bundles.set(bundleKey, existing);
  }

  const result: TimezoneOption[] = [];

  for (const entries of bundles.values()) {
    for (const chunk of chunkEntries(entries, MAX_CITIES_PER_ROW)) {
      const cities = chunk.map((entry) => entry.city);

      result.push({
        value: chunk[0]?.iana ?? "",
        label: buildBundleLabel(chunk[0]?.offsetMinutes ?? 0, cities),
        values: chunk.map((entry) => entry.iana),
        offsetMinutes: chunk[0]?.offsetMinutes ?? 0,
      });
    }
  }

  result.sort((left, right) => {
    if (left.offsetMinutes !== right.offsetMinutes) {
      return left.offsetMinutes - right.offsetMinutes;
    }

    return left.label.localeCompare(right.label);
  });

  const sortedResult = result.filter((option) => option.value);

  timezoneOptionsCache.set(locale, sortedResult);
  return sortedResult;
}

export function findTimezoneOption(
  timeZone: string,
  locale = "en",
): TimezoneOption | null {
  if (!timeZone) {
    return null;
  }

  const match = getTimezoneOptions(locale).find((option) =>
    option.values.includes(timeZone),
  );

  if (match) {
    return match;
  }

  const city = formatCityName(timeZone);
  const offsetMinutes = getOffsetMinutes(timeZone);

  return {
    value: timeZone,
    label: buildBundleLabel(offsetMinutes, [city]),
    values: [timeZone],
    offsetMinutes,
  };
}

export function resolveTimezoneSelection(
  currentValue: string,
  option: TimezoneOption,
): string {
  if (option.values.includes(currentValue)) {
    return currentValue;
  }

  return option.value;
}
