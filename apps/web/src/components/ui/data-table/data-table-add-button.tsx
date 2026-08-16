"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

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
