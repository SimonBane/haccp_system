"use client";

import type {
  CompleteTodayTaskInput,
  CompleteTodayTemperatureTaskInput,
  TodayResponse,
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
import { queryKeys } from "@/lib/api/query-keys";
import {
  applyOptimisticCompletion,
  applyOptimisticTemperature,
  applyOptimisticUncompletion,
} from "../lib/optimistic";

type OptimisticContext = {
  key: ReturnType<typeof queryKeys.today>;
  previous: TodayResponse | undefined;
};

/**
 * Every mutation patches the cache before the request goes out, so a tap lands
 * instantly and the row reverts only if the server rejects it.
 */
export function useTodayMutations(currentUserId: string, timeZone: string) {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const todayPath = locationScopedPath(locationId, "today");

  async function beginOptimistic(
    date: string,
    update: (previous: TodayResponse | undefined) => TodayResponse | undefined,
  ): Promise<OptimisticContext> {
    const key = queryKeys.today(locationId, date);
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<TodayResponse>(key);
    queryClient.setQueryData<TodayResponse>(key, (old) => update(old));
    return { key, previous };
  }

  function rollback(context: OptimisticContext | undefined) {
    if (!context) return;
    queryClient.setQueryData(context.key, context.previous);
  }

  function settle(context: OptimisticContext | undefined) {
    if (!context) return;
    void queryClient.invalidateQueries({ queryKey: context.key });
  }

  const completeTask = useMutation({
    mutationFn: async (input: CompleteTodayTaskInput) => {
      const payload = completeTodayTaskSchema.parse(input);
      return fetchJson(`${todayPath}/complete`, todayTaskItemSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onMutate: (input) =>
      beginOptimistic(input.date, (previous) =>
        applyOptimisticCompletion(previous, input, currentUserId),
      ),
    onError: (_error, _input, context) => rollback(context),
    onSettled: (_data, _error, _input, context) => settle(context),
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
    onMutate: (input) =>
      beginOptimistic(input.date, (previous) =>
        applyOptimisticUncompletion(previous, input, timeZone),
      ),
    onError: (_error, _input, context) => rollback(context),
    onSettled: (_data, _error, _input, context) => settle(context),
  });

  const completeTemperatureTask = useMutation({
    mutationFn: async (input: CompleteTodayTemperatureTaskInput) => {
      const payload = completeTodayTemperatureTaskSchema.parse(input);
      return fetchJson(
        `${todayPath}/complete-temperature`,
        todayTaskItemSchema,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
    },
    onMutate: (input) =>
      beginOptimistic(input.date, (previous) =>
        applyOptimisticTemperature(previous, input, currentUserId),
      ),
    onError: (_error, _input, context) => rollback(context),
    onSettled: (_data, _error, _input, context) => settle(context),
  });

  return { completeTask, uncompleteTask, completeTemperatureTask };
}
