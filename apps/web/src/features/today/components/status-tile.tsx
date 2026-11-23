import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Button wraps its children in a span, so the row's own layout has to reach through it. */
export const ROW_BUTTON_CLASS =
  "h-auto min-h-14 w-full justify-start rounded-none px-4 py-2 text-left font-normal whitespace-normal [&>span]:w-full [&>span]:gap-3.5";

export type TileTone = "primary" | "muted" | "success" | "destructive";

const TONE_CLASS: Record<TileTone, string> = {
  primary: "bg-primary/10 text-primary dark:bg-primary/25 dark:text-foreground",
  muted: "bg-muted text-foreground",
  success: "bg-success text-success-foreground",
  destructive: "bg-destructive text-white",
};

type Props = {
  icon: LucideIcon;
  tone: TileTone;
  size?: "default" | "lg";
  className?: string;
};

/** The round icon that says what a row is and how it stands, never the only signal. */
export function StatusTile({
  icon: Icon,
  tone,
  size = "default",
  className,
}: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "lg" ? "size-10" : "size-8",
        TONE_CLASS[tone],
        className,
      )}
    >
      <Icon className={size === "lg" ? "size-5" : "size-4"} />
    </span>
  );
}
