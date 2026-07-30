"use client";

import {
  organizationResponseSchema,
  updateOrganizationNameSchema,
  updateOrganizationSchema,
  type UpdateOrganizationInput,
  type UpdateOrganizationNameInput,
} from "@haccp/shared";
import { useMutation } from "@tanstack/react-query";
import { useAuthenticatedFetch } from "@/lib/api/client";

export function useOrganizationMutations() {
  const { fetchJson } = useAuthenticatedFetch();

  const updateName = useMutation({
    mutationFn: async (input: UpdateOrganizationNameInput) => {
      const payload = updateOrganizationNameSchema.parse(input);
      return fetchJson("/organizations/current/name", organizationResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (input: UpdateOrganizationInput) => {
      const payload = updateOrganizationSchema.parse(input);
      return fetchJson("/organizations/current", organizationResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
  });

  return { updateName, updateSettings };
}
