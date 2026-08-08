"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { ReactNode } from "react";
import { getClerkLocalePath, getClerkLocalization } from "@/lib/clerk-localization";
import type { Locale } from "@/i18n/routing";

/**
 * Wraps ClerkProvider so the localization bundle is resolved on the client.
 *
 * @clerk/localizations ships ~88KB per locale. Resolving it in the server layout
 * and passing it as a prop serialized all of it into the flight payload of every
 * cold document load, uncacheable, on a product whose primary client is a
 * wall-mounted tablet. Selecting it here instead puts both locales in a
 * content-hashed JS chunk the browser and service worker can cache forever.
 *
 * This cannot be scoped to the (auth) routes: the sidebar's user menu opens
 * Clerk's profile modal, so the dashboard needs the localization too.
 */
export function AppClerkProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <ClerkProvider
      telemetry={false}
      appearance={{ theme: shadcn }}
      localization={getClerkLocalization(locale)}
      signInUrl={getClerkLocalePath(locale, "/sign-in")}
      signUpUrl={getClerkLocalePath(locale, "/sign-up")}
      signInFallbackRedirectUrl={getClerkLocalePath(locale, "/dashboard")}
      signUpFallbackRedirectUrl={getClerkLocalePath(locale, "/dashboard")}
      afterSignOutUrl={getClerkLocalePath(locale, "/")}
    >
      {children}
    </ClerkProvider>
  );
}
