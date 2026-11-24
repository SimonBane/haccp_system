"use client";

import {
  FORM_APPLIES_TO,
  resolveLimits,
  type AnswersInput,
  type CorrectiveInput,
  type FormVersionSummaryMap,
  type TodayOnDemandForm,
  type TodayOnDemandItem,
} from "@haccp/shared";
import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FALLBACK_FORM_ICON,
  FORM_CATEGORY_ICONS,
} from "@/features/forms/lib/category-icon";
import { CheckForm } from "./check-form";
import { ROW_BUTTON_CLASS, StatusTile } from "./status-tile";

type Props = {
  forms: TodayOnDemandForm[];
  /** Every item at the location; a per-item form is logged against one of them. */
  items: TodayOnDemandItem[];
  formVersions: FormVersionSummaryMap;
  /** Tells staff which day and time the entry will be filed under. */
  savedNote: string;
  onCreate: (
    form: TodayOnDemandForm,
    item: TodayOnDemandItem | null,
    values: AnswersInput,
    corrective?: CorrectiveInput,
  ) => Promise<boolean>;
};

/** Picks the form, then the item for a per-item form, then fills it in. */
export function LogEntryPanel({
  forms,
  items,
  formVersions,
  savedNote,
  onCreate,
}: Props) {
  const t = useTranslations("TodayPage.logEntry");
  const tForms = useTranslations("Forms");
  const [formId, setFormId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  const chosen = forms.find((item) => item.formId === formId) ?? null;
  const target = items.find((item) => item.targetId === targetId) ?? null;
  const version = chosen ? (formVersions[chosen.formVersionId] ?? null) : null;
  const needsTarget = chosen?.appliesTo === FORM_APPLIES_TO.PER_ITEM;

  function back() {
    if (target) setTargetId(null);
    else setFormId(null);
  }

  if (!chosen) {
    return (
      <div className="flex flex-col gap-4" data-testid="log-entry-panel">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <ul className="divide-y overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {forms.map((item) => {
            const itemForm = formVersions[item.formVersionId];
            const Icon = itemForm
              ? FORM_CATEGORY_ICONS[itemForm.category]
              : FALLBACK_FORM_ICON;

            return (
              <li key={item.formId}>
                <Button
                  variant="ghost"
                  className={ROW_BUTTON_CLASS}
                  onClick={() => {
                    setTargetId(null);
                    setFormId(item.formId);
                  }}
                >
                  <StatusTile icon={Icon} tone="primary" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {itemForm
                        ? tForms(`categories.${itemForm.category}`)
                        : null}
                    </span>
                  </span>
                  <ChevronRightIcon className="shrink-0 text-muted-foreground" />
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (needsTarget && !target) {
    return (
      <div className="flex flex-col gap-4" data-testid="log-entry-panel">
        <div>
          <h3 className="font-medium">{chosen.name}</h3>
          <p className="text-sm text-muted-foreground">
            {items.length > 0 ? t("pickItem") : t("noItems")}
          </p>
        </div>
        <ul className="divide-y overflow-hidden rounded-xl ring-1 ring-foreground/10 empty:hidden">
          {items.map((item) => (
            <li key={item.targetId}>
              <Button
                variant="ghost"
                className={ROW_BUTTON_CLASS}
                onClick={() => setTargetId(item.targetId)}
              >
                <span className="min-w-0 flex-1 font-medium">
                  {item.targetName}
                </span>
                <ChevronRightIcon className="shrink-0 text-muted-foreground" />
              </Button>
            </li>
          ))}
        </ul>
        <div>
          <Button variant="outline" onClick={back}>
            {t("back")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="log-entry-panel">
      <div>
        <h3 className="font-medium">
          {target ? `${chosen.name} · ${target.targetName}` : chosen.name}
        </h3>
        <p className="text-sm text-muted-foreground">{savedNote}</p>
      </div>
      {version ? (
        <CheckForm
          entryKey={`log-${chosen.formId}-${target?.targetId ?? "none"}`}
          definition={version.definition}
          limits={resolveLimits(version.definition, target?.limits)}
          initialValues={null}
          initialCorrective={null}
          saveLabel={t("save")}
          secondary={
            <Button
              variant="outline"
              className="max-xl:h-12"
              onClick={back}
            >
              {t("back")}
            </Button>
          }
          onSubmit={(values, corrective) =>
            onCreate(chosen, target, values, corrective)
          }
        />
      ) : null}
    </div>
  );
}
