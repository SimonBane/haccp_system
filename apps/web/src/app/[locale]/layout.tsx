import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LocaleHtmlLang } from "@/components/locale-html-lang";
import { ThemeColorSync } from "@/components/theme-color-sync";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppClerkProvider } from "@/components/providers/app-clerk-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { routing, type Locale } from "@/i18n/routing";

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
      // Opaque status bar: iOS then keeps the app out of the notch and the home
      // indicator itself, so nothing here has to reason about safe areas.
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
    // One entry, deliberately not media-scoped: a `prefers-color-scheme` query
    // resolves against the OS, while the app's own theme comes from next-themes
    // and can differ. `ThemeColorSync` owns this from mount onward; this is only
    // the pre-hydration value.
    themeColor: "#ffffff",
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
    <AppClerkProvider locale={resolvedLocale}>
      <NextIntlClientProvider messages={messages}>
        <LocaleHtmlLang />
        <ThemeColorSync />
        <ServiceWorkerRegistration />
        <QueryProvider>
          <TooltipProvider>
            {/* Neutral full-height column, wrapping both the dashboard and the
                auth pages. */}
            <div className="flex min-h-dvh flex-col bg-background">
              {children}
            </div>
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </QueryProvider>
      </NextIntlClientProvider>
    </AppClerkProvider>
  );
}
