import type { MeasurementUnit } from "@haccp/shared";
import { CheckIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnitIcon } from "./unit-option";
import type { MeasurementVerdict } from "../lib/measurement";

export type LimitChipTone = "default" | "own" | "invalid" | "pass";

const TONE_CLASS: Record<LimitChipTone, string> = {
  default: "border-border bg-background text-muted-foreground",
  own: "border-primary/35 bg-primary/[0.08] text-primary",
  invalid: "border-destructive/50 bg-destructive/10 text-destructive",
  pass: "border-success bg-success text-success-foreground",
};

/** The allowed-range chip, shared by the task builder's limit editor and the checks staff fill in. */
export function limitChipClass(
  tone: LimitChipTone,
  { interactive = false }: { interactive?: boolean } = {},
): string {
  return cn(
    "inline-flex h-8 max-w-44 shrink-0 items-center gap-1.5 truncate rounded-lg border px-2.5 text-[13px] font-medium whitespace-nowrap tabular-nums",
    TONE_CLASS[tone],
    interactive &&
      "cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    interactive && tone === "default" && "hover:bg-muted",
  );
}

type LimitChipProps = {
  /** "0 to 4 °C" */
  limits: string;
  unit: MeasurementUnit;
  /** What a screen reader hears instead, e.g. "Allowed 0 to 4 °C". */
  label: string;
  /** Colours the chip once a reading is in; null while nothing is filled. */
  verdict?: MeasurementVerdict | null;
  className?: string;
};

const VERDICT_ICON = {
  pass: CheckIcon,
  fail: TriangleAlertIcon,
} as const;

export function LimitChip({
  limits,
  unit,
  label,
  verdict = null,
  className,
}: LimitChipProps) {
  const VerdictIcon = verdict ? VERDICT_ICON[verdict] : null;
  const tone: LimitChipTone =
    verdict === "pass" ? "pass" : verdict === "fail" ? "invalid" : "default";

  return (
    <span
      className={cn(limitChipClass(tone), "transition-colors", className)}
      title={label}
      data-verdict={verdict ?? undefined}
    >
      {VerdictIcon ? (
        <VerdictIcon className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <UnitIcon unit={unit} className="size-3.5 shrink-0" />
      )}
      <span className="truncate" aria-hidden>
        {limits}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
