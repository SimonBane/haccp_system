import { apiErrorSchema, type ApiError } from "@haccp/shared";
import { z } from "zod";
import { env } from "@/env";

export const API_BASE_URL = env.NEXT_PUBLIC_API_URL;

export const WEB_API_ERROR_CODE = {
  NETWORK: "NETWORK_ERROR",
  INVALID_ERROR_RESPONSE: "INVALID_ERROR_RESPONSE",
  INVALID_RESPONSE: "INVALID_API_RESPONSE",
} as const;

export type ApiRequestErrorKind =
  "api" | "network" | "invalid_error_response" | "invalid_response";

type ApiRequestErrorOptions = {
  code: string;
  kind: ApiRequestErrorKind;
  status?: number;
  requestId?: string;
  details?: unknown;
  cause?: unknown;
};

export class ApiRequestError extends Error {
  readonly code: string;
  readonly kind: ApiRequestErrorKind;
  readonly status: number | undefined;
  readonly requestId: string | undefined;
  readonly details: unknown;

  constructor(message: string, options: ApiRequestErrorOptions) {
    super(message, { cause: options.cause });
    this.name = "ApiRequestError";
    this.code = options.code;
    this.kind = options.kind;
    this.status = options.status;
    this.requestId = options.requestId;
    this.details = options.details;
  }
}

export function networkRequestError(cause: unknown): ApiRequestError {
  return new ApiRequestError("The API request could not be completed", {
    code: WEB_API_ERROR_CODE.NETWORK,
    kind: "network",
    cause,
  });
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

export async function throwIfApiError(response: Response): Promise<Response> {
  if (response.ok) {
    return response;
  }

  const error = await parseApiError(response);

  if (error) {
    throw new ApiRequestError(error.message, {
      code: error.error,
      kind: "api",
      status: response.status,
      requestId: error.requestId,
      details: error.details,
    });
  }

  throw new ApiRequestError("The API returned an invalid error response", {
    code: WEB_API_ERROR_CODE.INVALID_ERROR_RESPONSE,
    kind: "invalid_error_response",
    status: response.status,
  });
}

export async function parseApiJson<T>(
  response: Response,
  schema: { parse: (data: unknown) => T },
): Promise<T> {
  let body: unknown;

  try {
    body = await response.json();
  } catch (cause) {
    throw new ApiRequestError("The API returned invalid JSON", {
      code: WEB_API_ERROR_CODE.INVALID_RESPONSE,
      kind: "invalid_response",
      status: response.status,
      cause,
    });
  }

  try {
    return schema.parse(body);
  } catch (cause) {
    throw new ApiRequestError("The API response did not match its schema", {
      code: WEB_API_ERROR_CODE.INVALID_RESPONSE,
      kind: "invalid_response",
      status: response.status,
      cause: cause instanceof z.ZodError ? cause : undefined,
    });
  }
}
