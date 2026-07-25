"use client";

import type {
  CompleteTodayTaskInput,
  CompleteTodayTemperatureTaskInput,
  TodayResponse,
  TodayTaskItem,
} from "@haccp/shared";
import {
  completeTodayTemperatureTaskSchema,
  completeTodayTaskSchema,
  todayResponseSchema,
  todayTaskItemSchema,
} from "@haccp/shared";
import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { API_BASE_URL, ApiRequestError, parseApiError } from "@/lib/api-utils";

async function fetchWithToken(
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

async function fetchJsonWithToken<T>(
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

function localTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function useTodayApi() {
  const { getToken } = useAuth();

  const getToday = useCallback(
    async (date?: string): Promise<TodayResponse> => {
      const occurrenceDate = date ?? localTodayDate();
      return fetchJsonWithToken(
        getToken,
        `/today?date=${encodeURIComponent(occurrenceDate)}`,
        todayResponseSchema,
      );
    },
    [getToken],
  );

  const completeTask = useCallback(
    async (input: CompleteTodayTaskInput): Promise<TodayTaskItem> => {
      const payload = completeTodayTaskSchema.parse(input);
      return fetchJsonWithToken(
        getToken,
        "/today/complete",
        todayTaskItemSchema,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
    },
    [getToken],
  );

  const uncompleteTask = useCallback(
    async (input: CompleteTodayTaskInput): Promise<TodayTaskItem> => {
      const payload = completeTodayTaskSchema.parse(input);
      return fetchJsonWithToken(
        getToken,
        "/today/complete",
        todayTaskItemSchema,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
    },
    [getToken],
  );

  const completeTemperatureTask = useCallback(
    async (
      input: CompleteTodayTemperatureTaskInput,
    ): Promise<TodayTaskItem> => {
      const payload = completeTodayTemperatureTaskSchema.parse(input);
      return fetchJsonWithToken(
        getToken,
        "/today/complete-temperature",
        todayTaskItemSchema,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
    },
    [getToken],
  );

  return {
    getToday,
    completeTask,
    uncompleteTask,
    completeTemperatureTask,
    localTodayDate,
  };
}
