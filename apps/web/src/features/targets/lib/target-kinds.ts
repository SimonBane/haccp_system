import {
  STARTER_TARGET_TYPES,
  TARGET_KIND,
  type LibraryLocale,
  type TargetKind,
  type TargetTypeResponse,
} from "@haccp/shared";
import {
  LayoutGridIcon,
  RefrigeratorIcon,
  SquareIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react";

export const TARGET_KIND_ICONS: Record<TargetKind, LucideIcon> = {
  [TARGET_KIND.EQUIPMENT]: RefrigeratorIcon,
  [TARGET_KIND.AREA]: LayoutGridIcon,
  [TARGET_KIND.SURFACE]: SquareIcon,
  [TARGET_KIND.VEHICLE]: TruckIcon,
};

export type StarterTargetType = { key: string; name: string; kind: TargetKind };

function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/** Suggestions the organisation does not have yet, matched by name so a renamed type is not offered twice. */
export function missingStarterTypes(
  existing: readonly Pick<TargetTypeResponse, "name">[],
  locale: LibraryLocale,
): StarterTargetType[] {
  const taken = new Set(existing.map((type) => normalizeName(type.name)));

  return STARTER_TARGET_TYPES.flatMap((starter) => {
    const name = starter.name[locale];
    return taken.has(normalizeName(name))
      ? []
      : [{ key: starter.key, name, kind: starter.kind }];
  });
}
