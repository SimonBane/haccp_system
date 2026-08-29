"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import {
  API_BASE_URL,
  ApiRequestError,
  networkRequestError,
  parseApiJson,
  throwIfApiError,
} from "./api-utils";

export async function fetchWithToken(
  getToken: () => Promise<string | null>,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    const token = await getToken();
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    return await throwIfApiError(response);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }

    throw networkRequestError(error);
  }
}

export async function fetchJsonWithToken<T>(
  getToken: () => Promise<string | null>,
  path: string,
  schema: { parse: (data: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const response = await fetchWithToken(getToken, path, init);
  return parseApiJson(response, schema);
}

export async function fetchVoidWithToken(
  getToken: () => Promise<string | null>,
  path: string,
  init?: RequestInit,
): Promise<void> {
  await fetchWithToken(getToken, path, init);
}

export function useAuthenticatedFetch(): {
  fetchJson: <T>(
    path: string,
    schema: { parse: (data: unknown) => T },
    init?: RequestInit,
  ) => Promise<T>;
  fetchVoid: (path: string, init?: RequestInit) => Promise<void>;
} {
  const { getToken } = useAuth();

  const fetchJson = useCallback(
    async <T>(
      path: string,
      schema: { parse: (data: unknown) => T },
      init?: RequestInit,
    ) => fetchJsonWithToken(getToken, path, schema, init),
    [getToken],
  );

  const fetchVoid = useCallback(
    async (path: string, init?: RequestInit) =>
      fetchVoidWithToken(getToken, path, init),
    [getToken],
  );

  return { fetchJson, fetchVoid };
}
