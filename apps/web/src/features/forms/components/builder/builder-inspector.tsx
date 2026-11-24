"use client";

import { CopyIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { FIELD_TYPE_ICONS } from "../../lib/category-icon";
import type { BuilderField, FieldIssues } from "../../lib/form-builder";
import { FieldSettings } from "./field-editor";

/** What the canvas has selected; the inspector shows its settings and nothing else. */
export type BuilderSelection =
  { kind: "form" } | { kind: "field"; id: string } | { kind: "corrective" };

type Props = {
  idPrefix: string;
  selection: BuilderSelection;
  field: BuilderField | null;
  index: number;
  count: number;
  issues: FieldIssues | undefined;
  onChange: (next: BuilderField) => void;
  parameterLocked: boolean;
  onDuplicate: () => void;
  onRemove: () => void;
  formDetails: ReactNode;
  corrective: ReactNode;
};

function Heading({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {description}
        </span>
      </div>
    </div>
  );
}

export function BuilderInspector({
  idPrefix,
  selection,
  field,
  index,
  count,
  issues,
  onChange,
  parameterLocked,
  onDuplicate,
  onRemove,
  formDetails,
  corrective,
}: Props) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");

  if (selection.kind === "form") {
    return (
      <div
        className="flex flex-col gap-5 p-5"
        data-testid="form-builder-form-details"
      >
        <Heading
          icon={<PencilIcon className="size-4" aria-hidden />}
          title={t("formDetails")}
          description={t("formDetailsHint")}
        />
        {formDetails}
      </div>
    );
  }

  if (selection.kind === "corrective") {
    return <div className="p-5">{corrective}</div>;
  }

  if (!field) {
    return (
      <Empty className="py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PencilIcon />
          </EmptyMedia>
          <EmptyTitle>{t("selectFieldTitle")}</EmptyTitle>
          <EmptyDescription>{t("selectFieldDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const Icon = FIELD_TYPE_ICONS[field.type];
  return (
    <div className="flex flex-col gap-5 p-5">
      <Heading
        icon={<Icon aria-hidden />}
        title={tForms(`fieldTypes.${field.type}`)}
        description={t("fieldPosition", { index: index + 1, count })}
      />
      <FieldSettings
        idPrefix={idPrefix}
        field={field}
        issues={issues}
        onChange={onChange}
        parameterLocked={parameterLocked}
      />
      <Separator />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDuplicate}>
          <CopyIcon data-icon="inline-start" />
          {t("duplicate")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2Icon data-icon="inline-start" />
          {t("deleteField")}
        </Button>
      </div>
    </div>
  );
}
