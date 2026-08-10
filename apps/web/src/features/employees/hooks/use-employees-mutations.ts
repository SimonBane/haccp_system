"use client";

import {
  createEmployeeSchema,
  employeeResponseSchema,
  updateEmployeeSchema,
  type CreateEmployeeInput,
  type EmployeeResponse,
  type UpdateEmployeeInput,
} from "@haccp/shared";
import { useAuth, useUser } from "@clerk/nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiRequestError, parseApiError } from "@/lib/api-utils";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";

export function useEmployeesMutations() {
  const { organization } = useTenant();
  const { fetchJson, fetchApi } = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const { userId: clerkUserId } = useAuth();
  const { user } = useUser();

  const invalidateEmployees = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.employees(organization.id),
    });
  };

  const reloadClerkUserIfSelf = async (employee: EmployeeResponse) => {
    if (
      employee.user.clerkUserId &&
      employee.user.clerkUserId === clerkUserId &&
      user
    ) {
      await user.reload();
    }
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
      const payload = updateEmployeeSchema.parse(input);
      return fetchJson(`/employees/${id}`, employeeResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    onSuccess: async (employee) => {
      invalidateEmployees();
      await reloadClerkUserIfSelf(employee);
    },
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
    remove,
  };
}
