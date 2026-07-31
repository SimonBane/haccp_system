export function locationScopedPath(
  locationId: string,
  resource: "equipment" | "task-templates" | "today",
  suffix = "",
): string {
  return `/locations/${locationId}/${resource}${suffix}`;
}
