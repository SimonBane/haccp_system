import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { API_BASE_URL } from "./env.js";

type ClerkGlobal = {
  Clerk?: { session?: { getToken: () => Promise<string | null> } };
};

/** The session's real Clerk token, so seeding goes through the same auth as the app. */
export async function sessionToken(page: Page): Promise<string> {
  const token = await page.evaluate(async () => {
    const { Clerk } = globalThis as unknown as ClerkGlobal;
    return (await Clerk?.session?.getToken()) ?? null;
  });

  expect(token, "no Clerk session token on the page").toBeTruthy();
  return token!;
}

export async function apiContext(page: Page): Promise<APIRequestContext> {
  const token = await sessionToken(page);

  return playwrightRequest.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
  });
}

export async function json<T>(
  api: APIRequestContext,
  method: "get" | "post" | "patch" | "delete",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await api[method](path, body ? { data: body } : undefined);

  if (!response.ok()) {
    throw new Error(
      `${method.toUpperCase()} ${path} → ${response.status()}: ${await response.text()}`,
    );
  }

  return (await response.json()) as T;
}
