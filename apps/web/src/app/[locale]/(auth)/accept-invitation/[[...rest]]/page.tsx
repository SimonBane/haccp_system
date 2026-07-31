import { Suspense } from "react";
import { type Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AcceptInvitationContent } from "@/components/auth/accept-invitation-content";

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  const t = await getTranslations("AcceptInvitationPage");

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t("processing")}</p>
        }
      >
        <AcceptInvitationContent />
      </Suspense>
    </div>
  );
}
