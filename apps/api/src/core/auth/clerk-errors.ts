import { isClerkAPIResponseError } from "@clerk/backend/errors";
import { ServiceUnavailableError } from "../errors/app-errors.js";

const CLERK_TIMEOUT_MS = 5000;

export function clerkErrorStatus(error: unknown): number | null {
  return isClerkAPIResponseError(error) ? error.status : null;
}

// @clerk/backend sets no fetch timeout, so a hung connection would hang the request.
export async function withClerkTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new ServiceUnavailableError("Identity provider timed out")),
      CLERK_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
