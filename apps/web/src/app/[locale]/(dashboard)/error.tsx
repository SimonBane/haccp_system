"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { CenteredShell } from "@/components/layout/centered-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isSentryEnabled } from "@/lib/sentry";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("DashboardErrorPage");

  useEffect(() => {
    if (isSentryEnabled()) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <CenteredShell>
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset}>{t("retry")}</Button>
        </CardContent>
      </Card>
    </CenteredShell>
  );
}
