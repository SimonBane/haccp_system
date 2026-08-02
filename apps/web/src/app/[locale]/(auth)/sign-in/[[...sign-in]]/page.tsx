import { SignIn } from "@clerk/nextjs";
import { type Locale } from "@/i18n/routing";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getClerkLocalePath } from "@/lib/clerk-localization";
import { getAcceptInvitationRedirectUrl } from "@/lib/auth/redirect-invitation-ticket";

export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const resolvedLocale = locale as Locale;
  setRequestLocale(resolvedLocale);

  const acceptInvitationUrl = getAcceptInvitationRedirectUrl(
    resolvedLocale,
    await searchParams,
  );

  if (acceptInvitationUrl) {
    redirect(acceptInvitationUrl);
  }

  const dashboardPath = getClerkLocalePath(resolvedLocale, "/dashboard");

  return (
    <SignIn
      forceRedirectUrl={dashboardPath}
      fallbackRedirectUrl={dashboardPath}
    />
  );
}
