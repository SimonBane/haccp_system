"use client";

import type { TaskRecordInput, TodayResponse } from "@haccp/shared";
import { taskRecordInputSchema, taskRecordResponseSchema } from "@haccp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { locationScopedPath } from "@/lib/api/paths";
import { queryKeys } from "@/lib/api/query-keys";
import { applyOptimisticRecord, applyOptimisticVoid } from "../lib/optimistic";
import type { RecordMutationInput } from "../lib/optimistic";

type OptimisticContext = {
  key: ReturnType<typeof queryKeys.today>;
  previous: TodayResponse | undefined;
};

type VoidRecordInput = { occurrenceId: string; date: string };
type RecordInput = RecordMutationInput & { date: string };

export function useTodayMutations(currentUserId: string) {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  function recordPath(occurrenceId: string): string {
    return locationScopedPath(locationId, "today/occurrences", `/${occurrenceId}/record`);
  }

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

  const createRecord = useMutation({
    mutationFn: async (input: RecordInput) => {
      // Extra keys (occurrenceId, date) are stripped by the plain (non-strict) object schema.
      const payload: TaskRecordInput = taskRecordInputSchema.parse(input);
      return fetchJson(recordPath(input.occurrenceId), taskRecordResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onMutate: (input) =>
      beginOptimistic(input.date, (previous) =>
        applyOptimisticRecord(previous, input, currentUserId),
      ),
    onError: (_error, _input, context) => rollback(context),
    onSettled: (_data, _error, _input, context) => settle(context),
  });

  const updateRecord = useMutation({
    mutationFn: async (input: RecordInput) => {
      const payload: TaskRecordInput = taskRecordInputSchema.parse(input);
      return fetchJson(recordPath(input.occurrenceId), taskRecordResponseSchema, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onMutate: (input) =>
      beginOptimistic(input.date, (previous) =>
        applyOptimisticRecord(previous, input, currentUserId),
      ),
    onError: (_error, _input, context) => rollback(context),
    onSettled: (_data, _error, _input, context) => settle(context),
  });

  const voidRecord = useMutation({
    mutationFn: async (input: VoidRecordInput) => {
      return fetchJson(recordPath(input.occurrenceId), taskRecordResponseSchema, {
        method: "DELETE",
      });
    },
    onMutate: (input) =>
      beginOptimistic(input.date, (previous) =>
        applyOptimisticVoid(previous, input.occurrenceId),
      ),
    onError: (_error, _input, context) => rollback(context),
    onSettled: (_data, _error, _input, context) => settle(context),
  });

  return { createRecord, updateRecord, voidRecord };
}
