import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "./api-utils";
import { reportUnexpectedWebError } from "./error-reporting";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      handlesError?: boolean;
    };
  }
}

type QueryClientOptions = {
  showError: (error: unknown) => void;
};

export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (failureCount >= 1) {
    return false;
  }

  if (!(error instanceof ApiRequestError)) {
    return true;
  }

  return error.status === undefined || error.status >= 500;
}

export function createQueryClient({
  showError,
}: QueryClientOptions): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        reportUnexpectedWebError(error);
        if (!mutation.meta?.handlesError) {
          showError(error);
        }
      },
    }),
    queryCache: new QueryCache({
      onError: (error, query) => {
        reportUnexpectedWebError(error);
        if (query.state.data !== undefined) {
          showError(error);
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
      },
    },
  });
}
