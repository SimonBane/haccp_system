import { SignUp } from "@clerk/nextjs";
import { type Locale } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-6 py-16">
      <SignUp forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard" />
    </div>
  );
}
