"use client";

import { SignIn, SignUp, useAuth } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getClerkLocalePath } from "@/lib/clerk-localization";
import { useEffect, useRef } from "react";
import { FullPageLoader } from "@/components/layout/full-page-loader";

export function AcceptInvitationContent() {
  const t = useTranslations("AcceptInvitationPage");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const { getToken, isLoaded, isSignedIn, orgId } = useAuth();
  const acceptStarted = useRef(false);
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
      await getToken({ skipCache: true });
      // Full page load so Clerk cookies exist before dashboard RSC runs.
      window.location.replace(getClerkLocalePath(locale, "/dashboard"));
    }

    void completeAcceptance();
  }, [getToken, invitationAccepted, isLoaded, locale]);

  if (!token && isLoaded && !(isSignedIn && orgId)) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        {t("noToken")}
      </p>
    );
  }

  // Clerk drives this page with __clerk_status. A ticket without one is expired,
  // tampered with, or opened directly — no branch below can advance it, so without
  // this the page holds a loader forever.
  if (isLoaded && token && !accountStatus && !invitationAccepted) {
    return (
      <div
        className="flex flex-col items-center gap-4 text-center"
        data-testid="invitation-invalid"
      >
        <p className="text-sm text-muted-foreground">{t("invalidTicket")}</p>
        <Link
          href="/sign-in"
          className={buttonVariants({ variant: "outline" })}
        >
          {t("backToSignIn")}
        </Link>
      </div>
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
