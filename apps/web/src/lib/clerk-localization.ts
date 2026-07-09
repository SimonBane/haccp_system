import { bgBG, enUS } from "@clerk/localizations";
import { routing, type Locale } from "@/i18n/routing";

const clerkLocalizations = {
  bg: bgBG,
  en: enUS,
} as const;

export function getClerkLocalization(locale: Locale): typeof bgBG | typeof enUS {
  return clerkLocalizations[locale];
}

export function getClerkLocalePath(locale: Locale, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (locale === routing.defaultLocale) {
    return normalizedPath;
  }

  return `/${locale}${normalizedPath}`;
}
