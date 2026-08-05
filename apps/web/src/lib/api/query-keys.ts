export const queryKeys = {
  today: (locationId: string, date: string) =>
    ["today", locationId, date] as const,
  /** Prefix matching every cached day for a location. */
  todayByLocation: (locationId: string) => ["today", locationId] as const,
  equipment: (locationId: string) => ["equipment", locationId] as const,
  taskTemplates: (locationId: string) => ["task-templates", locationId] as const,
  locations: () => ["locations"] as const,
  employees: () => ["employees"] as const,
};

export function isLocationScopedQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return root === "today" || root === "equipment" || root === "task-templates";
}
