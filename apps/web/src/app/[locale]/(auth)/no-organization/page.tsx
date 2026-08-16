import { type Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CenteredShell } from "@/components/layout/centered-shell";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function NoOrganizationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("NoOrganizationPage");

  return (
    <CenteredShell>
      <Card className="w-full max-w-lg" data-testid="no-organization-card">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Signing out is the only real exit: "/" redirects a signed-in user to
              /dashboard, which redirects back here for want of an org. */}
          <SignOutButton label={t("signOut")} testId="no-organization-sign-out" />
        </CardContent>
      </Card>
    </CenteredShell>
  );
}
