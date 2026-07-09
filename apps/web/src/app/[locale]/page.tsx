import { type Locale } from "@/i18n/routing";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getHealth } from "@/lib/api-client";
import { HomeAuthControls } from "@/components/home-auth-controls";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("HomePage");
  const health = await getHealth();

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-16">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            {t("badge")}
          </p>
          <CardTitle className="text-3xl">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="rounded-xl bg-muted p-6">
            <h2 className="text-sm font-medium text-muted-foreground">
              {t("apiHealth")}
            </h2>
            {health ? (
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("status")}</dt>
                  <dd className="font-medium text-primary">{health.status}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("service")}</dt>
                  <dd className="font-medium">{health.service}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("timestamp")}</dt>
                  <dd className="font-medium">{health.timestamp}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-destructive">
                {t("apiUnreachable")}{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">pnpm dev</code>
                .
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter>
          <HomeAuthControls />
        </CardFooter>
      </Card>
    </div>
  );
}
