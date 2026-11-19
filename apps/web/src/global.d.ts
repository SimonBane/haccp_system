// next-env.d.ts is git-ignored and absent in CI, so static image imports need these types from here.
/// <reference types="next/image-types/global" />
import type { routing } from "./i18n/routing";
import type bg from "../messages/bg.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof bg;
  }
}
