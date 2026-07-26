"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import { API_BASE_URL, ApiRequestError, parseApiError } from "./api-utils";

export async function fetchWithToken(
  getToken: () => Promise<string | null>,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getToken();

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export async function fetchJsonWithToken<T>(
  getToken: () => Promise<string | null>,
  path: string,
  schema: { parse: (data: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const response = await fetchWithToken(getToken, path, init);

  if (!response.ok) {
    const error = await parseApiError(response);
    throw new ApiRequestError(
      error?.message ?? `Request failed with ${response.status}`,
      error?.error ?? "UNKNOWN",
    );
  }

  const body: unknown = await response.json();
  return schema.parse(body);
}

export function useApiRefresh() {
  const router = useRouter();

  return useCallback(() => {
    router.refresh();
  }, [router]);
}

export function useAuthenticatedFetch(): {
  fetchJson: <T>(
    path: string,
    schema: { parse: (data: unknown) => T },
    init?: RequestInit,
  ) => Promise<T>;
  fetchApi: (path: string, init?: RequestInit) => Promise<Response>;
  refresh: () => void;
  getToken: () => Promise<string | null>;
} {
  const { getToken } = useAuth();
  const refresh = useApiRefresh();

  const fetchJson = useCallback(
    async <T>(
      path: string,
      schema: { parse: (data: unknown) => T },
      init?: RequestInit,
    ) => fetchJsonWithToken(getToken, path, schema, init),
    [getToken],
  );

  const fetchApi = useCallback(
    async (path: string, init?: RequestInit) => fetchWithToken(getToken, path, init),
    [getToken],
  );

  return { fetchJson, fetchApi, refresh, getToken };
}
