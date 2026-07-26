"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useEffect } from "react";

const redirectUrl = "/dashboard";

export function AcceptInvitationContent() {
  const t = useTranslations("AcceptInvitationPage");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("__clerk_ticket");
  const accountStatus = searchParams.get("__clerk_status");

  useEffect(() => {
    if (accountStatus === "complete") {
      router.replace(redirectUrl);
    }
  }, [accountStatus, router]);

  if (!token) {
    return (
      <p className="text-center text-sm text-muted-foreground">{t("noToken")}</p>
    );
  }

  if (accountStatus === "complete") {
    return (
      <p className="text-center text-sm text-muted-foreground">{t("completing")}</p>
    );
  }

  if (accountStatus === "sign_in") {
    return (
      <SignIn
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl={redirectUrl}
      />
    );
  }

  if (accountStatus === "sign_up") {
    return (
      <SignUp
        forceRedirectUrl={redirectUrl}
        fallbackRedirectUrl={redirectUrl}
      />
    );
  }

  return (
    <p className="text-center text-sm text-muted-foreground">{t("processing")}</p>
  );
}
