"use client";

import type { OnDemandRecordInput, TodayResponse } from "@haccp/shared";
import {
  onDemandRecordInputSchema,
  taskRecordInputSchema,
  taskRecordResponseSchema,
} from "@haccp/shared";
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

type CreateRecordInput = RecordMutationInput & {
  occurrenceId: string;
  date: string;
};
type UpdateRecordInput = RecordMutationInput & {
  recordId: string;
  date: string;
};
type VoidRecordInput = { key: string; recordId: string; date: string };
type CreateEntryInput = OnDemandRecordInput & { formId: string };

const JSON_HEADERS = { "Content-Type": "application/json" };

export function useTodayMutations(currentUserId: string) {
  const { locationId } = useLocation();
  const { fetchJson } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

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

  function settle() {
    // Every date: Today also reads yesterday's checks, so one cached day is not enough.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.todayByLocation(locationId),
    });
    // The whole location-scoped Records family: any cached range, page or filter
    // variant may now hold a stale row for this record.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.records(locationId),
    });
  }

  const createRecord = useMutation({
    meta: { handlesError: true },
    mutationFn: async (input: CreateRecordInput) =>
      // Extra keys (key, occurrenceId, date) are stripped by the plain (non-strict) object schema.
      fetchJson(
        locationScopedPath(
          locationId,
          "today/occurrences",
          `/${input.occurrenceId}/record`,
        ),
        taskRecordResponseSchema,
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(taskRecordInputSchema.parse(input)),
        },
      ),
    onMutate: (input) =>
      beginOptimistic(input.date, (previous) =>
        applyOptimisticRecord(previous, input, currentUserId),
      ),
    onError: (_error, _input, context) => rollback(context),
    onSettled: () => settle(),
  });

  const updateRecord = useMutation({
    meta: { handlesError: true },
    mutationFn: async (input: UpdateRecordInput) =>
      fetchJson(
        locationScopedPath(locationId, "today/records", `/${input.recordId}`),
        taskRecordResponseSchema,
        {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify(taskRecordInputSchema.parse(input)),
        },
      ),
    onMutate: (input) =>
      beginOptimistic(input.date, (previous) =>
        applyOptimisticRecord(previous, input, currentUserId),
      ),
    onError: (_error, _input, context) => rollback(context),
    onSettled: () => settle(),
  });

  const voidRecord = useMutation({
    meta: { handlesError: true },
    mutationFn: async (input: VoidRecordInput) =>
      fetchJson(
        locationScopedPath(locationId, "today/records", `/${input.recordId}`),
        taskRecordResponseSchema,
        { method: "DELETE" },
      ),
    onMutate: (input) =>
      beginOptimistic(input.date, (previous) =>
        applyOptimisticVoid(previous, input.key),
      ),
    onError: (_error, _input, context) => rollback(context),
    onSettled: () => settle(),
  });

  // Not optimistic: there is no item to patch until the server has created it.
  const createEntry = useMutation({
    meta: { handlesError: true },
    mutationFn: async (input: CreateEntryInput) =>
      fetchJson(
        locationScopedPath(
          locationId,
          "today/forms",
          `/${input.formId}/records`,
        ),
        taskRecordResponseSchema,
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(onDemandRecordInputSchema.parse(input)),
        },
      ),
    onSettled: () => settle(),
  });

  return { createRecord, updateRecord, voidRecord, createEntry };
}
