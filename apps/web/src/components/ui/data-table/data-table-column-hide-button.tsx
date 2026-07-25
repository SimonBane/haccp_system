"use client";

import type { Column } from "@tanstack/react-table";
import { EyeOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataTableColumnHideButtonProps<TData, TValue> {
  column: Column<TData, TValue>;
  className?: string;
}

export function DataTableColumnHideButton<TData, TValue>({
  column,
  className,
}: DataTableColumnHideButtonProps<TData, TValue>) {
  const t = useTranslations("DataTable.columnHeader");

  if (!column.getCanHide()) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
        className,
      )}
      aria-label={t("hideColumn")}
      onClick={(event) => {
        event.stopPropagation();
        column.toggleVisibility(false);
      }}
    >
      <EyeOffIcon className="h-4 w-4" />
    </Button>
  );
}
