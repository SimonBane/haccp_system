"use client";

import { FilterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import type { TargetScope } from "@/features/targets/lib/target-tree";

const SCOPES: readonly TargetScope[] = ["all", "equipment", "rooms"];

/** The Records-style filter button, with the one choice this list has: what to show. */
export function ScopeFilter({
  value,
  onChange,
}: {
  value: TargetScope;
  onChange: (scope: TargetScope) => void;
}) {
  const t = useTranslations("TargetsPage.scope");
  const tFilters = useTranslations("DataTable.filters");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 border-dashed bg-card"
          />
        }
      >
        <FilterIcon />
        {tFilters("label")}
        {value === "all" ? null : (
          <>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {t(value)}
            </Badge>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-fit min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("label")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value}
            onValueChange={(next) => onChange(next as TargetScope)}
          >
            {SCOPES.map((scope) => (
              <DropdownMenuRadioItem key={scope} value={scope}>
                {t(scope)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
