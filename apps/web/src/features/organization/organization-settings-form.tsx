"use client";

import type { OrganizationResponse } from "@haccp/shared";
import {
  organizationResponseSchema,
  tenantContextResponseSchema,
  updateOrganizationSchema,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import { TriangleAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TimezonePicker } from "@/features/organization/timezone-picker";
import { OrganizationLogoUpload } from "@/features/organization/organization-logo-upload";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
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
import { useAuthenticatedFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/get-error-message";

type SettingsSection = "general" | "regional" | "locations";

type OrganizationSettingsFormProps = {
  initialOrganization: OrganizationResponse;
};

const settingsCardFooterClassName =
  "justify-end border-t bg-muted/40 px-(--card-spacing) py-3 [.border-t]:pt-3";

export function OrganizationSettingsForm({
  initialOrganization,
}: OrganizationSettingsFormProps) {
  const t = useTranslations("SettingsPage");
  const { fetchJson } = useAuthenticatedFetch();
  const { organization, refreshTenant, locations } = useTenant();
  const localeLabels = useMemo(
    () => ({
      bg: t("localeBg"),
      en: t("localeEn"),
    }),
    [t],
  );

  const [name, setName] = useState(initialOrganization.name);
  const [timezone, setTimezone] = useState(initialOrganization.timezone);
  const [locale, setLocale] = useState(initialOrganization.locale);
  const [multipleLocationsEnabled, setMultipleLocationsEnabled] = useState(
    initialOrganization.multipleLocationsEnabled,
  );
  const [showMultipleLocationsDisableWarning, setShowMultipleLocationsDisableWarning] =
    useState(false);
  const [submittingSections, setSubmittingSections] = useState<
    Record<SettingsSection, boolean>
  >({
    general: false,
    regional: false,
    locations: false,
  });

  const isGeneralDirty = name !== organization.name;
  const isRegionalDirty =
    timezone !== organization.timezone || locale !== organization.locale;
  const isLocationsDirty =
    multipleLocationsEnabled !== organization.multipleLocationsEnabled;
  const cannotDisableMultipleLocations =
    showMultipleLocationsDisableWarning && locations.length > 1;

  function handleMultipleLocationsChange(checked: boolean) {
    if (!checked && locations.length > 1) {
      setShowMultipleLocationsDisableWarning(true);
      return;
    }

    setShowMultipleLocationsDisableWarning(false);
    setMultipleLocationsEnabled(checked);
  }

  async function saveSection(section: SettingsSection) {
    const isSectionDirty =
      section === "general"
        ? isGeneralDirty
        : section === "regional"
          ? isRegionalDirty
          : isLocationsDirty;

    if (!isSectionDirty || submittingSections[section]) {
      return;
    }

    setSubmittingSections((current) => ({ ...current, [section]: true }));

    try {
      const input = updateOrganizationSchema.parse({
        name: section === "general" && isGeneralDirty ? name : undefined,
        timezone:
          section === "regional" && timezone !== organization.timezone
            ? timezone
            : undefined,
        locale:
          section === "regional" && locale !== organization.locale
            ? locale
            : undefined,
        multipleLocationsEnabled:
          section === "locations" && isLocationsDirty
            ? multipleLocationsEnabled
            : undefined,
      });

      await fetchJson("/organizations/current", organizationResponseSchema, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const tenant = await fetchJson(
        "/tenant/current",
        tenantContextResponseSchema,
      );
      refreshTenant(tenant);
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Card className="gap-0 p-0">
        <CardHeader className="px-(--card-spacing) pt-(--card-spacing)">
          <CardTitle>{t("sections.general.title")}</CardTitle>
          <CardDescription>{t("sections.general.description")}</CardDescription>
        </CardHeader>
        <CardContent className="px-(--card-spacing) pb-(--card-spacing)">
          <FieldGroup>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:items-start">
              <Field>
                <FieldLabel htmlFor="organization-name">{t("name")}</FieldLabel>
                <Input
                  id="organization-name"
                  maxLength={256}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>

              <OrganizationLogoUpload organization={organization} />
            </div>
          </FieldGroup>
        </CardContent>
        <CardFooter className={settingsCardFooterClassName}>
          <Button
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
        <CardHeader className="px-(--card-spacing) pt-(--card-spacing)">
          <CardTitle>{t("sections.regional.title")}</CardTitle>
          <CardDescription>{t("sections.regional.description")}</CardDescription>
        </CardHeader>
        <CardContent className="px-(--card-spacing) pb-(--card-spacing)">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="timezone">{t("timezone")}</FieldLabel>
              <TimezonePicker
                id="timezone"
                value={timezone}
                onValueChange={setTimezone}
              />
            </Field>

            <Field>
              <FieldLabel>{t("locale")}</FieldLabel>
              <Select
                value={locale}
                onValueChange={(value) =>
                  setLocale(value as OrganizationResponse["locale"])
                }
              >
                <SelectTrigger>
                  <SelectValue>{localeLabels[locale]}</SelectValue>
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectItem value="bg">{t("localeBg")}</SelectItem>
                  <SelectItem value="en">{t("localeEn")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className={settingsCardFooterClassName}>
          <Button
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
            <Switch
              id="multiple-locations"
              checked={multipleLocationsEnabled}
              onCheckedChange={handleMultipleLocationsChange}
              size="lg"
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
            isLoading={submittingSections.locations}
            onClick={() => void saveSection("locations")}
            size="sm"
            type="button"
          >
            {t("save")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
