export const queryKeys = {
  today: (locationId: string, date: string) =>
    ["today", locationId, date] as const,
  todayByLocation: (locationId: string) => ["today", locationId] as const,
  equipment: (locationId: string) => ["equipment", locationId] as const,
  taskTemplates: (locationId: string) => ["task-templates", locationId] as const,
  // Org-scoped so switching Clerk org cannot serve the previous org's cache.
  locations: (organizationId: string) => ["locations", organizationId] as const,
  employees: (organizationId: string) => ["employees", organizationId] as const,
};

export function isLocationScopedQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return root === "today" || root === "equipment" || root === "task-templates";
}
