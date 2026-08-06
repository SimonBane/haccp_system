"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileHeaderActions } from "@/components/layout/mobile-header-slot";
import { useIsMobile } from "@/hooks/use-mobile";

type MobileHeaderAddButtonProps = {
  label: string;
  onClick: () => void;
};

export function MobileHeaderAddButton({
  label,
  onClick,
}: MobileHeaderAddButtonProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return null;
  }

  return (
    <MobileHeaderActions>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        className="shrink-0 rounded-lg border-sidebar-border bg-transparent text-foreground shadow-none hover:bg-transparent"
        aria-label={label}
        onClick={onClick}
      >
        <PlusIcon className="size-5" />
      </Button>
    </MobileHeaderActions>
  );
}
