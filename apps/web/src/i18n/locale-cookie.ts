import { localeCookieMaxAge, type Locale } from "./routing";

const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${localeCookieMaxAge}; SameSite=Lax`;
}
