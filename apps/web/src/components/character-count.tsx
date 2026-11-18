import { cn } from "@/lib/utils";

/** Inputs are capped with `maxLength`; this shows how close the text is. `showFrom` hides it on roomy fields until it matters. */
export function CharacterCount({
  value,
  max,
  showFrom = 0,
  className,
}: {
  value: string;
  max: number;
  /** Share of `max` (0–1) at which the count appears. */
  showFrom?: number;
  className?: string;
}) {
  const length = value.length;
  if (length < max * showFrom) return null;

  return (
    <span
      aria-live="polite"
      className={cn(
        "shrink-0 text-xs text-muted-foreground tabular-nums",
        length >= max && "font-medium text-foreground",
        className,
      )}
    >
      {length}/{max}
    </span>
  );
}
