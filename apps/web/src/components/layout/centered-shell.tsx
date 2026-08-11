import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Full-height shell for a standalone page — sign-in, an error, a 404.
 *
 * Two elements rather than one. The document no longer scrolls, so this has to
 * own its scroll region; and centring directly on a scroll container clips the
 * leading edge unrecoverably once the content is taller than the viewport
 * (overflow to the top is simply unreachable). The inner `min-h-full` centres
 * while still letting the box grow past the fold.
 */
export function CenteredShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className="h-full overflow-y-auto overscroll-contain">
      <div
        className={cn(
          "flex min-h-full w-full items-center justify-center p-safe",
          className,
        )}
      >
        {children}
      </div>
    </main>
  );
}
