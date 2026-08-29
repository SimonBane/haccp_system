"use client";

import { InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldLabel,
  REQUIRED_LABEL_CLASS,
} from "@/components/ui/field";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMPLETION_DUE_PRESET_ORDER,
  COMPLETION_OPENS_PRESET_ORDER,
  isAllowedMinutesInput,
  type CompletionDuePreset,
  type CompletionOpensPreset,
} from "@/features/task-templates/lib/completion-window";

type CompletionWindowFieldsProps = {
  idPrefix: string;
  opensValue: string;
  onOpensChange: (value: string) => void;
  onOpensBlur: () => void;
  opensInvalid: boolean;
  opensErrorMessage?: string;
  opensPreset: CompletionOpensPreset | null;
  onOpensPresetChange: (preset: CompletionOpensPreset) => void;
  dueValue: string;
  onDueChange: (value: string) => void;
  onDueBlur: () => void;
  dueInvalid: boolean;
  dueErrorMessage?: string;
  duePreset: CompletionDuePreset | null;
  onDuePresetChange: (preset: CompletionDuePreset) => void;
};

function FieldInfoHoverCard({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        aria-label={label}
        delay={20}
        closeDelay={50}
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <InfoIcon />
      </HoverCardTrigger>
      <HoverCardContent side="top" className={cn("w-64 text-sm", className)}>
        {children}
      </HoverCardContent>
    </HoverCard>
  );
}

export function CompletionWindowFields({
  idPrefix,
  opensValue,
  onOpensChange,
  onOpensBlur,
  opensInvalid,
  opensErrorMessage,
  opensPreset,
  onOpensPresetChange,
  dueValue,
  onDueChange,
  onDueBlur,
  dueInvalid,
  dueErrorMessage,
  duePreset,
  onDuePresetChange,
}: CompletionWindowFieldsProps) {
  const t = useTranslations("TasksPage");

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2">
      <Field data-invalid={opensInvalid}>
        <div className="flex items-center gap-1.5">
          <FieldLabel
            htmlFor={`${idPrefix}-opens`}
            className={REQUIRED_LABEL_CLASS}
          >
            {t("completionWindow.availableLabel")}
          </FieldLabel>
          <FieldInfoHoverCard
            label={t("completionWindow.availableInfoLabel")}
            className="w-56"
          >
            <p className="text-pretty">
              {t("completionWindow.availableInfoDescription")}
            </p>
          </FieldInfoHoverCard>
        </div>
        <Select
          items={COMPLETION_OPENS_PRESET_ORDER.map((preset) => ({
            label: t(`completionWindow.presets.opens.${preset}`),
            value: preset,
          }))}
          value={opensPreset}
          onValueChange={(value) =>
            onOpensPresetChange(value as CompletionOpensPreset)
          }
        >
          <SelectTrigger
            id={`${idPrefix}-opens`}
            aria-invalid={opensInvalid}
            className="w-full"
          >
            <SelectValue placeholder={t("completionWindow.availablePlaceholder")} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {COMPLETION_OPENS_PRESET_ORDER.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {t(`completionWindow.presets.opens.${preset}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {opensPreset === "custom" ? (
          <InputGroup>
            <InputGroupInput
              aria-label={t("completionWindow.customMinutesBefore")}
              type="text"
              inputMode="numeric"
              enterKeyHint="next"
              aria-invalid={opensInvalid}
              value={opensValue}
              onChange={(event) => {
                const next = event.target.value;
                if (!isAllowedMinutesInput(next)) return;
                onOpensChange(next);
              }}
              onBlur={onOpensBlur}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>
                {t("completionWindow.minutesSuffixBefore")}
              </InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        ) : null}
        {opensInvalid && opensErrorMessage ? (
          <FieldError>{opensErrorMessage}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={dueInvalid}>
        <div className="flex items-center gap-1.5">
          <FieldLabel
            htmlFor={`${idPrefix}-due`}
            className={REQUIRED_LABEL_CLASS}
          >
            {t("completionWindow.deadlineLabel")}
          </FieldLabel>
          <FieldInfoHoverCard
            label={t("completionWindow.deadlineInfoLabel")}
            className="w-72"
          >
            <p className="font-medium text-foreground">
              {t("completionWindow.deadlineInfoIntro")}
            </p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-[0.4em] size-1 shrink-0 rounded-full bg-muted-foreground"
                />
                <span className="text-pretty">
                  {t("completionWindow.deadlineInfoStillDoable")}
                </span>
              </li>
              <li className="flex gap-2">
                <span
                  aria-hidden
                  className="mt-[0.4em] size-1 shrink-0 rounded-full bg-muted-foreground"
                />
                <span className="text-pretty">
                  {t("completionWindow.deadlineInfoNoDeadline")}
                </span>
              </li>
            </ul>
          </FieldInfoHoverCard>
        </div>
        <Select
          items={COMPLETION_DUE_PRESET_ORDER.map((preset) => ({
            label: t(`completionWindow.presets.due.${preset}`),
            value: preset,
          }))}
          value={duePreset}
          onValueChange={(value) =>
            onDuePresetChange(value as CompletionDuePreset)
          }
        >
          <SelectTrigger
            id={`${idPrefix}-due`}
            aria-invalid={dueInvalid}
            className="w-full"
          >
            <SelectValue placeholder={t("completionWindow.deadlinePlaceholder")} />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {COMPLETION_DUE_PRESET_ORDER.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {t(`completionWindow.presets.due.${preset}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {duePreset === "custom" ? (
          <InputGroup>
            <InputGroupInput
              aria-label={t("completionWindow.customMinutesAfter")}
              type="text"
              inputMode="numeric"
              enterKeyHint="done"
              aria-invalid={dueInvalid}
              value={dueValue}
              onChange={(event) => {
                const next = event.target.value;
                if (!isAllowedMinutesInput(next)) return;
                onDueChange(next);
              }}
              onBlur={onDueBlur}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>
                {t("completionWindow.minutesSuffixAfter")}
              </InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        ) : null}
        {dueInvalid && dueErrorMessage ? (
          <FieldError>{dueErrorMessage}</FieldError>
        ) : null}
      </Field>
    </div>
  );
}
