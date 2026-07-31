"use client";

import type {
  CompleteTodayTaskInput,
  CompleteTodayTemperatureTaskInput,
} from "@haccp/shared";
import {
  completeTodayTemperatureTaskSchema,
  completeTodayTaskSchema,
  todayTaskItemSchema,
} from "@haccp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { locationScopedPath } from "@/lib/api/paths";

export function useTodayMutations() {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const todayPath = locationScopedPath(locationId, "today");

  const invalidateToday = () => {
    void queryClient.invalidateQueries({ queryKey: ["today"] });
  };

  const completeTask = useMutation({
    mutationFn: async (input: CompleteTodayTaskInput) => {
      const payload = completeTodayTaskSchema.parse(input);
      return fetchJson(`${todayPath}/complete`, todayTaskItemSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateToday,
  });

  const uncompleteTask = useMutation({
    mutationFn: async (input: CompleteTodayTaskInput) => {
      const payload = completeTodayTaskSchema.parse(input);
      return fetchJson(`${todayPath}/uncomplete`, todayTaskItemSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateToday,
  });

  const completeTemperatureTask = useMutation({
    mutationFn: async (input: CompleteTodayTemperatureTaskInput) => {
      const payload = completeTodayTemperatureTaskSchema.parse(input);
      return fetchJson(`${todayPath}/complete-temperature`, todayTaskItemSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateToday,
  });

  return {
    completeTask,
    uncompleteTask,
    completeTemperatureTask,
    isPending:
      completeTask.isPending ||
      uncompleteTask.isPending ||
      completeTemperatureTask.isPending,
  };
}
