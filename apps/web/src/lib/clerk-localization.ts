import { bgBG, enUS } from "@clerk/localizations";
import { getLocalizedPath } from "@haccp/shared";
import { routing, type Locale } from "@/i18n/routing";

const clerkLocalizations = {
  bg: bgBG,
  en: enUS,
} as const;

export function getClerkLocalization(locale: Locale): typeof bgBG | typeof enUS {
  return clerkLocalizations[locale];
}

export function getClerkLocalePath(locale: Locale, path: string): string {
  return getLocalizedPath(locale, path);
}
