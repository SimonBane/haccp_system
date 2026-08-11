import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LocaleHtmlLang } from "@/components/locale-html-lang";
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
      // Transparent status bar so the PWA paints behind the notch/Dynamic Island
      // (ChatGPT-style). Content must use safe-area insets — headers already do.
      statusBarStyle: "black-translucent",
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
    // Match the painted canvas so splash / chrome blend with the app surface.
    // These track --background, which is what the top bar paints; the previous
    // dark value was --sidebar and read as a lighter band above the content.
    themeColor: [
      { media: "(prefers-color-scheme: light)", color: "#ffffff" },
      { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    ],
    viewportFit: "cover",
    // The shell is a locked, fixed-height column, so the software keyboard has
    // nothing to scroll out of its way. Resizing the viewport instead keeps a
    // focused field — and a pinned form footer — above it.
    interactiveWidget: "resizes-content",
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
        <ServiceWorkerRegistration />
        <QueryProvider>
          <TooltipProvider>
            {/* Neutral full-height column: wraps both the dashboard and the
                auth pages, each of which decides for itself what scrolls. */}
            <div className="flex h-full min-h-0 flex-col bg-background">
              {children}
            </div>
            <Toaster position="bottom-right" />
          </TooltipProvider>
        </QueryProvider>
      </NextIntlClientProvider>
    </AppClerkProvider>
  );
}
