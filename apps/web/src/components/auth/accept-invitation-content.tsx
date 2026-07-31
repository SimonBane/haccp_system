"use client";

import { SignIn, SignUp, useAuth } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { type Locale } from "@/i18n/routing";
import { getClerkLocalePath } from "@/lib/clerk-localization";
import { useEffect, useRef } from "react";
import { API_BASE_URL } from "@/lib/api/api-utils";

export function AcceptInvitationContent() {
  const t = useTranslations("AcceptInvitationPage");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getToken, isLoaded, isSignedIn, orgId } = useAuth();
  const acceptStarted = useRef(false);
  const token = searchParams.get("__clerk_ticket");
  const accountStatus = searchParams.get("__clerk_status");
  const dashboardUrl = getClerkLocalePath(locale, "/dashboard");
  const acceptPageUrl = getClerkLocalePath(locale, "/accept-invitation");
  const completionRedirectUrl = `${acceptPageUrl}?__clerk_status=complete`;
  const invitationAccepted =
    accountStatus === "complete" || (!token && isSignedIn && Boolean(orgId));

  useEffect(() => {
    if (!isLoaded || !invitationAccepted || acceptStarted.current) {
      return;
    }

    acceptStarted.current = true;

    async function completeAcceptance() {
      try {
        const authToken = await getToken();

        if (authToken) {
          await fetch(`${API_BASE_URL}/invitations/accept`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          });
        }
      } finally {
        router.replace(dashboardUrl);
      }
    }

    void completeAcceptance();
  }, [
    dashboardUrl,
    getToken,
    invitationAccepted,
    isLoaded,
    router,
  ]);

  if (!token) {
    if (!isLoaded) {
      return (
        <p className="text-center text-sm text-muted-foreground">
          {t("processing")}
        </p>
      );
    }

    if (isSignedIn && orgId) {
      return (
        <p className="text-center text-sm text-muted-foreground">
          {t("completing")}
        </p>
      );
    }

    return (
      <p className="text-center text-sm text-muted-foreground">{t("noToken")}</p>
    );
  }

  if (invitationAccepted) {
    return (
      <p className="text-center text-sm text-muted-foreground">{t("completing")}</p>
    );
  }

  if (accountStatus === "sign_in") {
    return (
      <SignIn
        forceRedirectUrl={completionRedirectUrl}
        fallbackRedirectUrl={completionRedirectUrl}
      />
    );
  }

  if (accountStatus === "sign_up") {
    return (
      <SignUp
        forceRedirectUrl={completionRedirectUrl}
        fallbackRedirectUrl={completionRedirectUrl}
      />
    );
  }

  return (
    <p className="text-center text-sm text-muted-foreground">{t("processing")}</p>
  );
}
