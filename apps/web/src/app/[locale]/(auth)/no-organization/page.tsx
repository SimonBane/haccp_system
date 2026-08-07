import { type Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            {t("backHome")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
