export const queryKeys = {
  today: (locationId: string, date: string) =>
    ["today", locationId, date] as const,
  /** Prefix matching every cached day for a location. */
  todayByLocation: (locationId: string) => ["today", locationId] as const,
  equipment: (locationId: string) => ["equipment", locationId] as const,
  taskTemplates: (locationId: string) => ["task-templates", locationId] as const,
  // Org-scoped rather than bare, so switching Clerk organisation without a hard
  // reload cannot serve the previous org's rows out of a still-live cache.
  // Every other key carries a locationId for the same reason.
  locations: (organizationId: string) => ["locations", organizationId] as const,
  employees: (organizationId: string) => ["employees", organizationId] as const,
};

export function isLocationScopedQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return root === "today" || root === "equipment" || root === "task-templates";
}
