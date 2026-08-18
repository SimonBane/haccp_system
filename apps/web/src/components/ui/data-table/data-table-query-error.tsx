"use client";

import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DataTableQueryError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("DataTable.error");

  return (
    <Alert data-testid="data-table-error">
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription>{t("description")}</AlertDescription>
      <Button
        className="mt-4"
        data-testid="data-table-retry"
        onClick={onRetry}
      >
        {t("retry")}
      </Button>
    </Alert>
  );
}
