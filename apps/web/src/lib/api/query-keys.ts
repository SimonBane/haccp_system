export const queryKeys = {
  today: (date: string) => ["today", date] as const,
  equipment: (locationId: string) => ["equipment", locationId] as const,
  taskTemplates: (locationId: string) => ["task-templates", locationId] as const,
  locations: () => ["locations"] as const,
};
