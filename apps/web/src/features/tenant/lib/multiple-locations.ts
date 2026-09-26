/** Location names only mean something when the org has the feature on and more than one site. */
export function hasMultipleLocations(
  organization: { multipleLocationsEnabled: boolean },
  locations: readonly unknown[],
): boolean {
  return organization.multipleLocationsEnabled && locations.length > 1;
}
