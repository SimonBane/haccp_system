"use client";

import {
  createEmployeeSchema,
  employeeResponseSchema,
  updateEmployeeLocationsSchema,
  updateEmployeeRoleSchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type UpdateEmployeeInput,
  type UpdateEmployeeLocationsInput,
  type UpdateEmployeeRoleInput,
} from "@haccp/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError, parseApiError } from "@/lib/api-utils";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function useEmployeesMutations() {
  const { fetchJson, fetchApi } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const invalidateEmployees = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.employees(),
    });
  };

  const create = useMutation({
    mutationFn: async (input: CreateEmployeeInput) => {
      const payload = createEmployeeSchema.parse(input);
      return fetchJson("/employees", employeeResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidateEmployees,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateEmployeeInput;
    }) => {
      updateEmployeeSchema.parse(input);
      return fetchJson(`/employees/${id}`, employeeResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    },
    onSuccess: invalidateEmployees,
  });

  const invite = useMutation({
    mutationFn: async (id: string) => {
      return fetchJson(`/employees/${id}/invite`, employeeResponseSchema, {
        method: "POST",
      });
    },
    onSuccess: invalidateEmployees,
  });

  const revokeInvitation = useMutation({
    mutationFn: async (id: string) => {
      return fetchJson(`/employees/${id}/invitation`, employeeResponseSchema, {
        method: "DELETE",
      });
    },
    onSuccess: invalidateEmployees,
  });

  const updateRole = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateEmployeeRoleInput;
    }) => {
      updateEmployeeRoleSchema.parse(input);
      return fetchJson(`/employees/${id}/role`, employeeResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    },
    onSuccess: invalidateEmployees,
  });

  const updateLocations = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateEmployeeLocationsInput;
    }) => {
      updateEmployeeLocationsSchema.parse(input);
      return fetchJson(`/employees/${id}/locations`, employeeResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    },
    onSuccess: invalidateEmployees,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchApi(`/employees/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await parseApiError(response);
        throw new ApiRequestError(
          error?.message ?? `Request failed with ${response.status}`,
          error?.error ?? "UNKNOWN",
        );
      }
    },
    onSuccess: invalidateEmployees,
  });

  return {
    create,
    update,
    invite,
    revokeInvitation,
    updateRole,
    updateLocations,
    remove,
  };
}
