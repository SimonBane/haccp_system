"use client";

import { SignIn, SignUp, useAuth } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type Locale } from "@/i18n/routing";
import { getClerkLocalePath } from "@/lib/clerk-localization";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api/api-utils";
import { FullPageLoader } from "@/components/layout/full-page-loader";

export function AcceptInvitationContent() {
  const t = useTranslations("AcceptInvitationPage");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const { getToken, isLoaded, isSignedIn, orgId } = useAuth();
  const acceptStarted = useRef(false);
  const [acceptError, setAcceptError] = useState(false);
  const token = searchParams.get("__clerk_ticket");
  const accountStatus = searchParams.get("__clerk_status");
  const firstName = searchParams.get("firstName");
  const lastName = searchParams.get("lastName");
  const acceptPageUrl = getClerkLocalePath(locale, "/accept-invitation");
  const completionRedirectUrl = `${acceptPageUrl}?__clerk_status=complete`;
  const invitationAccepted =
    isLoaded &&
    isSignedIn &&
    Boolean(orgId) &&
    (accountStatus === "complete" || !token);

  useEffect(() => {
    if (!isLoaded || !invitationAccepted || acceptStarted.current) {
      return;
    }

    acceptStarted.current = true;

    async function completeAcceptance() {
      const authToken = await getToken({ skipCache: true });

      if (!authToken) {
        acceptStarted.current = false;
        setAcceptError(true);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/invitations/accept`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        acceptStarted.current = false;
        setAcceptError(true);
        return;
      }

      // Full page load so the server receives Clerk session cookies before dashboard RSC runs.
      window.location.replace(getClerkLocalePath(locale, "/dashboard"));
    }

    void completeAcceptance();
  }, [
    getToken,
    invitationAccepted,
    isLoaded,
    locale,
  ]);

  if (acceptError) {
    return (
      <p className="text-center text-sm text-destructive">{t("acceptError")}</p>
    );
  }

  if (!token && isLoaded && !(isSignedIn && orgId)) {
    return (
      <p className="text-center text-sm text-muted-foreground">{t("noToken")}</p>
    );
  }

  if (token && accountStatus === "sign_in" && !invitationAccepted) {
    return (
      <SignIn
        forceRedirectUrl={completionRedirectUrl}
        fallbackRedirectUrl={completionRedirectUrl}
      />
    );
  }

  if (token && accountStatus === "sign_up" && !invitationAccepted) {
    return (
      <SignUp
        initialValues={{
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
        }}
        forceRedirectUrl={completionRedirectUrl}
        fallbackRedirectUrl={completionRedirectUrl}
      />
    );
  }

  return <FullPageLoader />;
}
