"use client";

import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getApiErrorPresentation } from "@/lib/api/error-presentation";

export function ApiQueryError({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const t = useTranslations("ApiErrors");
  const presentation = getApiErrorPresentation(error, t);

  return (
    <Alert data-testid="data-table-error">
      <AlertTitle>{t("queryTitle")}</AlertTitle>
      <AlertDescription>
        <p>{presentation.message}</p>
        {presentation.description ? <p>{presentation.description}</p> : null}
      </AlertDescription>
      <Button className="mt-4" data-testid="data-table-retry" onClick={onRetry}>
        {t("retry")}
      </Button>
    </Alert>
  );
}
