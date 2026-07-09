import { auth } from "@clerk/nextjs/server";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { type Locale } from "@/i18n/routing";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const resolvedLocale = locale as Locale;
  setRequestLocale(resolvedLocale);

  const { userId } = await auth();

  redirect({
    href: userId ? "/dashboard" : "/sign-in",
    locale: resolvedLocale,
  });
}
