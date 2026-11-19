import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn("font-mono text-xs tracking-[0.14em] uppercase", className)}
    >
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  className,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Eyebrow className="text-primary dark:text-chart-2">{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-5xl">
        {title}
      </h2>
      {body && (
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">{body}</p>
      )}
    </div>
  );
}
