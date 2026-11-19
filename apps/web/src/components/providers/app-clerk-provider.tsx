"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { ReactNode } from "react";
import { getClerkLocalePath, getClerkLocalization } from "@/lib/clerk-localization";
import type { Locale } from "@/i18n/routing";

/** Resolve Clerk locale on the client so ~88KB bundles are not in the RSC payload. */
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
      // A signed-out kitchen tablet should land on sign-in, not the marketing page at "/".
      afterSignOutUrl={getClerkLocalePath(locale, "/sign-in")}
    >
      {children}
    </ClerkProvider>
  );
}
