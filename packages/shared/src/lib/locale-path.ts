import type { OrganizationResponse } from "../schemas/organization.js";

export const APP_DEFAULT_LOCALE = "bg" as const satisfies OrganizationResponse["locale"];

export type AppLocale = OrganizationResponse["locale"];

export function getLocalizedPath(locale: AppLocale, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (locale === APP_DEFAULT_LOCALE) {
    return normalizedPath;
  }

  return `/${locale}${normalizedPath}`;
}
