import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LocaleHtmlLang } from "@/components/locale-html-lang";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/components/providers/query-provider";
import { routing, type Locale } from "@/i18n/routing";
import {
  getClerkLocalization,
  getClerkLocalePath,
} from "@/lib/clerk-localization";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Metadata",
  });

  return {
    title: t("title"),
    description: t("description"),
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: t("title"),
    },
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        {
          url: "/icons/icon-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          url: "/icons/icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      apple: "/apple-touch-icon.png",
    },
  };
}

export function generateViewport() {
  return {
    colorScheme: "light dark",
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#252525" },
    ],
    viewportFit: "cover",
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale as Locale);

  const messages = await getMessages();
  const resolvedLocale = locale as Locale;

  return (
    <ClerkProvider
      telemetry={false}
      appearance={{ theme: shadcn }}
      localization={getClerkLocalization(resolvedLocale)}
      signInUrl={getClerkLocalePath(resolvedLocale, "/sign-in")}
      signUpUrl={getClerkLocalePath(resolvedLocale, "/sign-up")}
      signInFallbackRedirectUrl={getClerkLocalePath(resolvedLocale, "/dashboard")}
      signUpFallbackRedirectUrl={getClerkLocalePath(resolvedLocale, "/dashboard")}
      afterSignOutUrl={getClerkLocalePath(resolvedLocale, "/")}
    >
      <NextIntlClientProvider messages={messages}>
        <LocaleHtmlLang />
        <ServiceWorkerRegistration />
        <QueryProvider>
          <TooltipProvider>
            <div className="flex min-h-svh flex-col bg-background">
              {children}
            </div>
            <Toaster
              position="top-center"
              offset={{
                top: "max(0.5rem, env(safe-area-inset-top, 0px))",
              }}
            />
          </TooltipProvider>
        </QueryProvider>
      </NextIntlClientProvider>
    </ClerkProvider>
  );
}
