"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getApiErrorPresentation } from "@/lib/api/error-presentation";
import { createQueryClient } from "@/lib/api/query-client";

type QueryProviderProps = {
  children: ReactNode;
};

export function QueryProvider({ children }: QueryProviderProps) {
  const t = useTranslations("ApiErrors");
  const [queryClient] = useState(() =>
    createQueryClient({
      showError: (error) => {
        const presentation = getApiErrorPresentation(error, t);
        toast.error(presentation.message, {
          description: presentation.description,
        });
      },
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" ? (
        <ReactQueryDevtools initialIsOpen={false} />
      ) : null}
    </QueryClientProvider>
  );
}
