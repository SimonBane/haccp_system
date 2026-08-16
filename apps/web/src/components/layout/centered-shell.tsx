import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Full-height shell for a standalone page — sign-in, an error, a 404. */
export function CenteredShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "flex min-h-dvh w-full flex-1 items-center justify-center px-6 py-16",
        className,
      )}
    >
      {children}
    </main>
  );
}
