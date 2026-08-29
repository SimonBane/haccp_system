"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { toast, type ExternalToast } from "sonner";
import { getApiErrorPresentation } from "./error-presentation";
import { reportUnexpectedWebError } from "./error-reporting";

export function useApiErrorToast(): (
  error: unknown,
  options?: ExternalToast,
) => void {
  const t = useTranslations("ApiErrors");

  return useCallback(
    (error: unknown, options?: ExternalToast) => {
      reportUnexpectedWebError(error);
      const presentation = getApiErrorPresentation(error, t);
      toast.error(presentation.message, {
        ...options,
        description: presentation.description ?? options?.description,
      });
    },
    [t],
  );
}
