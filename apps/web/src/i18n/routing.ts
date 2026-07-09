import { defineRouting } from "next-intl/routing";

export const localeCookieMaxAge = 60 * 60 * 24 * 365;

export const routing = defineRouting({
  locales: ["bg", "en"],
  defaultLocale: "bg",
  localePrefix: "as-needed",
  localeDetection: true,
  localeCookie: {
    maxAge: localeCookieMaxAge,
  },
});

export type Locale = (typeof routing.locales)[number];
