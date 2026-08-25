import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

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
        "flex min-h-full w-full flex-1 items-center justify-center overflow-y-auto px-6 py-16",
        className,
      )}
    >
      {children}
    </main>
  );
}
