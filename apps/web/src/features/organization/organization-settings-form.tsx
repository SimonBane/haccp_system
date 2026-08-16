"use client";

import type { OrganizationResponse } from "@haccp/shared";
import { useTranslations } from "next-intl";
import { TriangleAlertIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Controller, useForm, useFormState } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TimezonePicker } from "@/features/organization/timezone-picker";
import { OrganizationLogoUpload } from "@/features/organization/organization-logo-upload";
import { useOrganizationMutations } from "@/features/organization/hooks/use-organization-mutations";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldTitle,
} from "@/components/ui/field";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTenant } from "@/features/tenant/tenant-provider";
import { getErrorMessage } from "@/lib/api/get-error-message";
import { useZodErrorMap } from "@/lib/forms/zod-error-map";

type SettingsSection = "general" | "regional" | "locations";

type SettingsValues = {
  name: string;
  timezone: string;
  locale: OrganizationResponse["locale"];
  multipleLocationsEnabled: boolean;
};

/** Which fields each card owns — drives both its dirty state and its save. */
const SECTION_FIELDS = {
  general: ["name"],
  regional: ["timezone", "locale"],
  locations: ["multipleLocationsEnabled"],
} as const satisfies Record<SettingsSection, readonly (keyof SettingsValues)[]>;

type OrganizationSettingsFormProps = {
  initialOrganization: OrganizationResponse;
};

const settingsCardFooterClassName =
  "justify-end border-t bg-muted/40 px-(--card-spacing) py-3 [.border-t]:pt-3";

const settingsCardHeaderClassName =
  "px-(--card-spacing) pt-(--card-spacing) pb-4";

export function OrganizationSettingsForm({
  initialOrganization,
}: OrganizationSettingsFormProps) {
  const t = useTranslations("SettingsPage");
  const { updateName, updateSettings } = useOrganizationMutations();
  const { organization, reloadTenant, locations } = useTenant();
  const localeLabels = useMemo(
    () => ({
      bg: t("localeBg"),
      en: t("localeEn"),
    }),
    [t],
  );

  const [showMultipleLocationsDisableWarning, setShowMultipleLocationsDisableWarning] =
    useState(false);
  // Per card: react-hook-form has one `isSubmitting`, but the three sections save independently.
  const [submittingSections, setSubmittingSections] = useState<
    Record<SettingsSection, boolean>
  >({
    general: false,
    regional: false,
    locations: false,
  });

  const zodErrorMap = useZodErrorMap();
  const settingsSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1).max(256),
        timezone: z.string().min(1),
        locale: z.enum(["bg", "en"]),
        multipleLocationsEnabled: z.boolean(),
      }),
    [],
  );

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema, { error: zodErrorMap }),
    defaultValues: {
      name: initialOrganization.name,
      timezone: initialOrganization.timezone,
      locale: initialOrganization.locale,
      multipleLocationsEnabled: initialOrganization.multipleLocationsEnabled,
    },
  });

  const { dirtyFields } = useFormState({ control: form.control });
  const isSectionDirty = useCallback(
    (section: SettingsSection) =>
      SECTION_FIELDS[section].some((field) => dirtyFields[field]),
    [dirtyFields],
  );

  const cannotDisableMultipleLocations =
    showMultipleLocationsDisableWarning && locations.length > 1;

  async function saveSection(section: SettingsSection) {
    if (!isSectionDirty(section) || submittingSections[section]) {
      return;
    }

    if (!(await form.trigger(SECTION_FIELDS[section]))) {
      return;
    }

    const values = form.getValues();
    setSubmittingSections((current) => ({ ...current, [section]: true }));

    try {
      if (section === "general") {
        await updateName.mutateAsync({ name: values.name });
      } else if (section === "regional") {
        await updateSettings.mutateAsync({
          ...(dirtyFields.timezone ? { timezone: values.timezone } : {}),
          ...(dirtyFields.locale ? { locale: values.locale } : {}),
        });
      } else {
        await updateSettings.mutateAsync({
          multipleLocationsEnabled: values.multipleLocationsEnabled,
        });
      }

      await reloadTenant();
      // Re-baseline this section only so saving one card does not clear another's dirty state.
      for (const field of SECTION_FIELDS[section]) {
        form.resetField(field, { defaultValue: values[field] });
      }
      if (section === "locations") {
        setShowMultipleLocationsDisableWarning(false);
      }
      toast.success(t("toast.saved"));
    } catch (err) {
      toast.error(getErrorMessage(err, t("errors.generic")));
    } finally {
      setSubmittingSections((current) => ({ ...current, [section]: false }));
    }
  }

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />

      <Card className="gap-0 p-0">
        <CardHeader className={settingsCardHeaderClassName}>
          <CardTitle>{t("sections.general.title")}</CardTitle>
        </CardHeader>
        <CardContent className="px-(--card-spacing) pb-(--card-spacing)">
          <FieldGroup>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:items-start">
              <FormField
                control={form.control}
                name="name"
                htmlFor="organization-name"
                label={t("name")}
                required
              >
                {({ field, id }) => (
                  <Input {...field} id={id} maxLength={256} />
                )}
              </FormField>

              <OrganizationLogoUpload organization={organization} />
            </div>
          </FieldGroup>
        </CardContent>
        <CardFooter className={settingsCardFooterClassName}>
          <Button
            disabled={!isSectionDirty("general")}
            isLoading={submittingSections.general}
            onClick={() => void saveSection("general")}
            size="sm"
            type="button"
          >
            {t("save")}
          </Button>
        </CardFooter>
      </Card>

      <Card className="gap-0 p-0">
        <CardHeader className={settingsCardHeaderClassName}>
          <CardTitle>{t("sections.regional.title")}</CardTitle>
        </CardHeader>
        <CardContent className="px-(--card-spacing) pb-(--card-spacing)">
          <FieldGroup>
            <FormField
              control={form.control}
              name="timezone"
              htmlFor="timezone"
              label={t("timezone")}
            >
              {({ field, id }) => (
                <TimezonePicker
                  id={id}
                  value={field.value}
                  onValueChange={field.onChange}
                />
              )}
            </FormField>

            <FormField
              control={form.control}
              name="locale"
              htmlFor="organization-locale"
              label={t("locale")}
            >
              {({ field, id }) => (
                <Select
                  value={field.value}
                  onValueChange={(value) =>
                    field.onChange(value as OrganizationResponse["locale"])
                  }
                >
                  <SelectTrigger id={id}>
                    <SelectValue>{localeLabels[field.value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="bg">{t("localeBg")}</SelectItem>
                    <SelectItem value="en">{t("localeEn")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
          </FieldGroup>
        </CardContent>
        <CardFooter className={settingsCardFooterClassName}>
          <Button
            disabled={!isSectionDirty("regional")}
            isLoading={submittingSections.regional}
            onClick={() => void saveSection("regional")}
            size="sm"
            type="button"
          >
            {t("save")}
          </Button>
        </CardFooter>
      </Card>

      <Card className="gap-0 p-0">
        <CardContent className="px-(--card-spacing) py-(--card-spacing)">
          <Field
            className="items-center has-[>[data-slot=field-content]]:items-center"
            orientation="horizontal"
          >
            <FieldContent>
              <FieldTitle>{t("multipleLocations")}</FieldTitle>
              <FieldDescription>
                {t("multipleLocationsDescription")}
              </FieldDescription>
            </FieldContent>
            <Controller
              control={form.control}
              name="multipleLocationsEnabled"
              render={({ field }) => (
                <Switch
                  id="multiple-locations"
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    if (!checked && locations.length > 1) {
                      setShowMultipleLocationsDisableWarning(true);
                      return;
                    }
                    setShowMultipleLocationsDisableWarning(false);
                    field.onChange(checked);
                  }}
                  size="lg"
                />
              )}
            />
          </Field>
          {cannotDisableMultipleLocations ? (
            <Alert className="mt-4 grid-cols-[auto_1fr] gap-x-2.5 border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-50">
              <span className="row-span-2 flex size-5 items-center justify-center self-start rounded bg-amber-500 text-white">
                <TriangleAlertIcon className="size-3" aria-hidden />
              </span>
              <AlertTitle className="text-amber-950 dark:text-amber-50">
                {t("multipleLocationsDisableWarningTitle")}
              </AlertTitle>
              <AlertDescription className="text-amber-900/80 dark:text-amber-100/80">
                {t("multipleLocationsDisableWarningDescription")}
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter className={settingsCardFooterClassName}>
          <Button
            disabled={!isSectionDirty("locations")}
            isLoading={submittingSections.locations}
            onClick={() => void saveSection("locations")}
            size="sm"
            type="button"
          >
            {t("save")}
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
