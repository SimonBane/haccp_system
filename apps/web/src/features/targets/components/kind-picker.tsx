"use client";

import { TARGET_KIND_VALUES, type TargetKind } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";

type KindPickerProps = {
  labelledBy: string;
  value: TargetKind;
  onChange: (kind: TargetKind) => void;
  disabled?: boolean;
};

export function KindPicker({
  labelledBy,
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
      className="grid w-full grid-cols-1 sm:grid-cols-3"
    >
      {TARGET_KIND_VALUES.map((kind) => {
        const KindIcon = TARGET_KIND_ICONS[kind];
        return (
          <ToggleGroupItem
            key={kind}
            value={kind}
            className="h-auto flex-col items-start gap-1 rounded-lg p-3 text-left whitespace-normal aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-foreground aria-pressed:hover:bg-primary/10"
          >
            <span className="flex items-center gap-2 font-medium">
              <KindIcon />
              {t(`kinds.${kind}`)}
            </span>
            <span className="text-xs font-normal text-muted-foreground">
              {t(`kindHints.${kind}`)}
            </span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
