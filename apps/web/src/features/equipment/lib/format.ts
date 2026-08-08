/**
 * Equipment temperature bounds as displayed in lists.
 *
 * Deliberately not the Today page's `formatTemperature`: that one is a locale
 * number formatter for a recorded reading, rendered next to a separate unit.
 * Here the bound and its unit are one inseparable label.
 */
export function formatTemp(value: number): string {
  return `${value}°C`;
}
