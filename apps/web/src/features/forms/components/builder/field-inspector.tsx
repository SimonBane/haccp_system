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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FIELD_TYPE_ICONS } from "../../lib/category-icon";
import type { BuilderField, FieldIssues } from "../../lib/form-builder";
import { FieldSettings } from "./field-editor";

export type InspectorTab = "field" | "form";

type Props = {
  idPrefix: string;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  field: BuilderField | null;
  index: number;
  count: number;
  issues: FieldIssues | undefined;
  onChange: (next: BuilderField) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  formSettings: ReactNode;
};

function FieldHeading({
  field,
  index,
  count,
}: {
  field: BuilderField;
  index: number;
  count: number;
}) {
  const t = useTranslations("FormsPage.builder");
  const tForms = useTranslations("Forms");
  const Icon = FIELD_TYPE_ICONS[field.type];

  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden />
      </span>
      <div className="flex flex-col">
        <span className="font-semibold">{tForms(`fieldTypes.${field.type}`)}</span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("fieldPosition", { index: index + 1, count })}
        </span>
      </div>
    </div>
  );
}

export function FieldInspector({
  idPrefix,
  tab,
  onTabChange,
  field,
  index,
  count,
  issues,
  onChange,
  onDuplicate,
  onRemove,
  formSettings,
}: Props) {
  const t = useTranslations("FormsPage.builder");

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => onTabChange(value as InspectorTab)}
      className="gap-0"
    >
      <TabsList variant="line" className="w-full justify-start border-b px-4">
        <TabsTrigger value="field">{t("fieldTab")}</TabsTrigger>
        <TabsTrigger value="form">{t("formSettings")}</TabsTrigger>
      </TabsList>

      <TabsContent value="field" className="p-5">
        {field ? (
          <div className="flex flex-col gap-5">
            <FieldHeading field={field} index={index} count={count} />
            <FieldSettings
              idPrefix={idPrefix}
              field={field}
              issues={issues}
              onChange={onChange}
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
        ) : (
          <Empty className="py-10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PencilIcon />
              </EmptyMedia>
              <EmptyTitle>{t("selectFieldTitle")}</EmptyTitle>
              <EmptyDescription>{t("selectFieldDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </TabsContent>

      <TabsContent value="form" className="p-5">
        {formSettings}
      </TabsContent>
    </Tabs>
  );
}
