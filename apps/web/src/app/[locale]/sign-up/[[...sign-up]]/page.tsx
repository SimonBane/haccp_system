import { SignUp } from "@clerk/nextjs";
import { type Locale } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { getClerkLocalePath } from "@/lib/clerk-localization";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = locale as Locale;
  setRequestLocale(resolvedLocale);

  const dashboardPath = getClerkLocalePath(resolvedLocale, "/dashboard");

  return (
    <SignUp
      forceRedirectUrl={dashboardPath}
      fallbackRedirectUrl={dashboardPath}
    />
  );
}
