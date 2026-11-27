"use client";

import type { RecordItem } from "@haccp/shared";
import { CheckIcon, CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  RECORD_OUTCOME,
  RECORD_OUTCOME_VARIANT,
  recordOutcome,
  type RecordOutcome,
} from "@/features/records/lib/records-outcome";

const OUTCOME_ICON: Partial<Record<RecordOutcome, typeof CheckIcon>> = {
  [RECORD_OUTCOME.PASSED]: CheckIcon,
  [RECORD_OUTCOME.ATTENTION]: CircleAlertIcon,
  [RECORD_OUTCOME.MISSED]: TriangleAlertIcon,
};

export function RecordOutcomeBadge({ item }: { item: RecordItem }) {
  const t = useTranslations("RecordsPage.outcome");
  const outcome = recordOutcome(item);
  const Icon = OUTCOME_ICON[outcome];

  return (
    <Badge variant={RECORD_OUTCOME_VARIANT[outcome]}>
      {Icon ? <Icon data-icon="inline-start" /> : null}
      {t(outcome)}
    </Badge>
  );
}
