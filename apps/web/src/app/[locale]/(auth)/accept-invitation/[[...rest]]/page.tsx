import { Suspense } from "react";
import { type Locale } from "@/i18n/routing";
import { setRequestLocale } from "next-intl/server";
import { AcceptInvitationContent } from "@/components/auth/accept-invitation-content";
import { FullPageLoader } from "@/components/layout/full-page-loader";

export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <Suspense fallback={<FullPageLoader />}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
