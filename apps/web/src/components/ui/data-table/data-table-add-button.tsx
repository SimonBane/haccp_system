"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The "add" affordance for a resource list — used both as the table toolbar and
 * as the call to action inside an empty state, which is why it is a component
 * rather than four private copies of the same six lines.
 */
export function DataTableAddButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <Button type="button" onClick={onClick}>
      <PlusIcon />
      {label}
    </Button>
  );
}
