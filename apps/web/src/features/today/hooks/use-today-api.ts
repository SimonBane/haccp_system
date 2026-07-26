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
import { useCallback } from "react";
import { fetchJsonWithToken } from "@/lib/api/client";
import { useAuth } from "@clerk/nextjs";

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
      return fetchJsonWithToken(getToken, "/today/complete", todayTaskItemSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    [getToken],
  );

  const uncompleteTask = useCallback(
    async (input: CompleteTodayTaskInput): Promise<TodayTaskItem> => {
      const payload = completeTodayTaskSchema.parse(input);
      return fetchJsonWithToken(
        getToken,
        "/today/uncomplete",
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
