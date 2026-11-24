"use client";

import type { TargetKind } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";
import { cn } from "@/lib/utils";

type KindPickerProps = {
  labelledBy: string;
  kinds: readonly TargetKind[];
  value: TargetKind;
  onChange: (kind: TargetKind) => void;
  disabled?: boolean;
};

export function KindPicker({
  labelledBy,
  kinds,
  value,
  onChange,
  disabled,
}: KindPickerProps) {
  const t = useTranslations("TargetsPage");

  return (
    <ToggleGroup
      aria-labelledby={labelledBy}
      value={[value]}
      // A single-select group still lets the pressed item be toggled off; keep one kind chosen.
      onValueChange={(next) => {
        const kind = next.at(-1) as TargetKind | undefined;
        if (kind) onChange(kind);
      }}
      variant="outline"
      spacing={2}
      disabled={disabled}
      className={cn(
        "grid w-full",
        kinds.length === 3 ? "grid-cols-3" : "grid-cols-2",
      )}
    >
      {kinds.map((kind) => {
        const KindIcon = TARGET_KIND_ICONS[kind];
        return (
          <ToggleGroupItem
            key={kind}
            value={kind}
            className="h-auto min-h-11 gap-1.5 rounded-lg px-2 py-2 text-center leading-tight whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-foreground aria-pressed:hover:bg-primary/10 md:min-h-9"
          >
            <KindIcon className="shrink-0" aria-hidden />
            {t(`kinds.${kind}`)}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
