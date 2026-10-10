"use client";

import {
  createFormSchema,
  createFormVersionSchema,
  formResponseSchema,
  updateFormSchema,
  type CreateFormInput,
  type FormDefinition,
  type UpdateFormInput,
} from "@haccp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function useFormsMutations() {
  const { organization } = useTenant();
  const { fetchJson, fetchVoid } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const invalidateForms = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.forms(organization.id),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.allTaskTemplates(),
    });
    void queryClient.invalidateQueries({ queryKey: queryKeys.allToday() });
  };

  const create = useMutation({
    meta: { handlesError: true },
    mutationFn: async (input: CreateFormInput) => {
      const payload = createFormSchema.parse(input);
      return fetchJson("/forms", formResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateForms,
  });

  const update = useMutation({
    meta: { handlesError: true },
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateFormInput;
    }) => {
      const payload = updateFormSchema.parse(input);
      return fetchJson(`/forms/${id}`, formResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateForms,
  });

  const publishVersion = useMutation({
    meta: { handlesError: true },
    mutationFn: async ({
      id,
      definition,
      confirmDroppedOverrides,
    }: {
      id: string;
      definition: FormDefinition;
      confirmDroppedOverrides: boolean;
    }) => {
      const payload = createFormVersionSchema.parse({
        definition,
        confirmDroppedOverrides,
      });
      return fetchJson(`/forms/${id}/versions`, formResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateForms,
  });

  const remove = useMutation({
    meta: { handlesError: true },
    mutationFn: async (id: string) => {
      await fetchVoid(`/forms/${id}`, { method: "DELETE" });
    },
    onSuccess: invalidateForms,
  });

  return { create, update, publishVersion, remove };
}
