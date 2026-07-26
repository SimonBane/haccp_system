import { apiErrorSchema, type ApiError } from "@haccp/shared";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

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
