import {
  apiErrorSchema,
  healthResponseSchema,
  type ApiError,
  type HealthResponse,
} from "@haccp/shared";
import { auth } from "@clerk/nextjs/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function parseApiError(
  response: Response,
): Promise<ApiError | null> {
  try {
    const body: unknown = await response.json();
    const parsed = apiErrorSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function fetchApi(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const { getToken } = await auth();
  const token = await getToken();

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export async function getHealth(): Promise<HealthResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return null;
    }

    const body: unknown = await response.json();
    const parsed = healthResponseSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
