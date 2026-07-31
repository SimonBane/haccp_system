"use client";

import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DataTableMobileCardMetadataRow = {
  label: string;
  value: ReactNode;
};

type DataTableMobileCardProps = {
  title: ReactNode;
  actions?: ReactNode;
  badges?: ReactNode;
  metadata?: DataTableMobileCardMetadataRow[];
  showChevron?: boolean;
  className?: string;
};

export function DataTableMobileCard({
  title,
  actions,
  badges,
  metadata,
  showChevron = false,
  className,
}: DataTableMobileCardProps) {
  return (
    <Card
      className={cn(
        "py-0 transition-colors active:scale-[0.99] active:bg-muted/50",
        className,
      )}
    >
      <CardHeader className="flex-row items-start gap-2 space-y-0 px-4 pt-4 pb-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium leading-tight">
              {title}
            </p>
          </div>
          {showChevron ? (
            <ChevronRightIcon
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : null}
        </div>
        {actions ? (
          <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
            {actions}
          </div>
        ) : null}
      </CardHeader>
      {badges || metadata?.length ? (
        <CardContent className="space-y-2 px-4 pb-4">
          {badges ? (
            <div className="flex flex-wrap items-center gap-2">{badges}</div>
          ) : null}
          {metadata?.length ? (
            <dl className="space-y-1.5">
              {metadata.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-3 gap-y-0.5 text-sm"
                >
                  <dt className="text-xs text-muted-foreground">{row.label}</dt>
                  <dd className="min-w-0 text-sm">{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function DataTableMobileCardBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn("inline-flex items-center gap-1", className)}>
      {children}
    </Badge>
  );
}
