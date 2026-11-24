"use client";

import { TARGET_KIND, type TargetResponse } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { limitChipClass } from "@/features/forms/components/limit-chip";
import { UnitIcon } from "@/features/forms/components/unit-option";
import { useAnswerFormat } from "@/features/forms/hooks/use-answer-format";
import { storedRanges } from "@/features/targets/lib/item-limits";
import { cn } from "@/lib/utils";

/** The item's own allowed range: a chip in the desktop column, plain text in a phone row's meta line. */
export function ItemRange({
  target,
  variant,
}: {
  target: TargetResponse;
  variant: "chip" | "inline";
}) {
  const t = useTranslations("TargetsPage.range");
  const format = useAnswerFormat();
  if (target.kind === TARGET_KIND.COMPONENT) return null;

  const ranges = storedRanges(target.limits);
  const [first, ...rest] = ranges;
  if (!first) return null;

  const text = format.limits(first.range, first.unit) ?? "";
  const label = [
    t("chipLabel", { limits: text }),
    rest.length > 0 ? t("more", { count: rest.length }) : null,
  ]
    .filter(Boolean)
    .join(" ");
  const more = rest.length > 0 ? `+${rest.length}` : null;

  if (variant === "inline") {
    return (
      <span className="flex shrink-0 items-center gap-1 tabular-nums" title={label}>
        <UnitIcon unit={first.unit} className="size-3 shrink-0" />
        <span aria-hidden>
          {text}
          {more ? ` ${more}` : null}
        </span>
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5" title={label}>
      <span className={cn(limitChipClass("default"), "text-foreground")}>
        <UnitIcon unit={first.unit} className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate" aria-hidden>
          {text}
        </span>
      </span>
      {more ? (
        <span aria-hidden className="text-xs text-muted-foreground tabular-nums">
          {more}
        </span>
      ) : null}
      <span className="sr-only">{label}</span>
    </span>
  );
}
