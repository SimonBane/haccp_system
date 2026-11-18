"use client";

import { TARGET_KIND } from "@haccp/shared";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { useTargetsMutations } from "@/features/targets/hooks/use-targets-mutations";
import { TARGET_KIND_ICONS } from "@/features/targets/lib/target-kinds";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";
import { cn } from "@/lib/utils";

const SUGGESTED_AREAS = [
  "kitchen",
  "coldStorage",
  "washingRoom",
  "changingRoom",
  "dryStore",
  "dispatch",
] as const;

const STEPS = ["areas", "equipment", "tasks"] as const;

type TargetsOnboardingProps = {
  onAddArea: () => void;
  onAddLooseEquipment: () => void;
};

export function TargetsOnboarding({
  onAddArea,
  onAddLooseEquipment,
}: TargetsOnboardingProps) {
  const t = useTranslations("TargetsPage.onboarding");
  const showApiError = useApiErrorToast();
  const { create } = useTargetsMutations();
  const [pending, setPending] = useState<string | null>(null);
  const AreaIcon = TARGET_KIND_ICONS.area;

  async function quickAdd(key: (typeof SUGGESTED_AREAS)[number]) {
    const name = t(`suggestions.${key}`);
    setPending(key);
    try {
      await create.mutateAsync({
        name,
        kind: TARGET_KIND.AREA,
        parentId: null,
      });
      toast.success(t("added", { name }));
    } catch (error) {
      showApiError(error);
    } finally {
      setPending(null);
    }
  }

  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AreaIcon />
        </EmptyMedia>
        <EmptyTitle>{t("title")}</EmptyTitle>
        <EmptyDescription>{t("description")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="max-w-2xl gap-6">
        <ol className="grid w-full gap-3 text-left sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className={cn(
                "flex flex-col gap-1 rounded-lg p-3",
                index === 0 ? "bg-primary/10" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "text-xs font-medium",
                  index === 0 ? "text-primary" : "text-muted-foreground",
                )}
              >
                {t("step", { number: index + 1 })}
              </span>
              <span className="text-sm font-medium">
                {t(`steps.${step}.title`)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t(`steps.${step}.hint`)}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("quickAdd")}</span>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTED_AREAS.map((key) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                isLoading={pending === key}
                disabled={pending !== null}
                onClick={() => void quickAdd(key)}
              >
                <PlusIcon data-icon="inline-start" />
                {t(`suggestions.${key}`)}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={onAddArea}>
            <PlusIcon data-icon="inline-start" />
            {t("addArea")}
          </Button>
          <Button type="button" variant="link" onClick={onAddLooseEquipment}>
            {t("addLooseEquipment")}
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
