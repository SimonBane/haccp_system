"use client";

import type { OrganizationResponse } from "@haccp/shared";
import {
  organizationResponseSchema,
  tenantContextResponseSchema,
  updateOrganizationSchema,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";

type OrganizationSettingsFormProps = {
  initialOrganization: OrganizationResponse;
};

export function OrganizationSettingsForm({
  initialOrganization,
}: OrganizationSettingsFormProps) {
  const t = useTranslations("SettingsPage");
  const { fetchJson } = useAuthenticatedFetch();
  const { refreshTenant } = useTenant();
  const [timezone, setTimezone] = useState(initialOrganization.timezone);
  const [locale, setLocale] = useState(initialOrganization.locale);
  const [multipleLocationsEnabled, setMultipleLocationsEnabled] = useState(
    initialOrganization.multipleLocationsEnabled,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const input = updateOrganizationSchema.parse({
        timezone,
        locale,
        multipleLocationsEnabled,
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
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.generic"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>{t("organizationName")}</Label>
            <Input disabled value={initialOrganization.name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">{t("timezone")}</Label>
            <Input
              id="timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("locale")}</Label>
            <Select
              value={locale}
              onValueChange={(value) =>
                setLocale(value as OrganizationResponse["locale"])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bg">{t("localeBg")}</SelectItem>
                <SelectItem value="en">{t("localeEn")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t("multipleLocations")}</p>
              <p className="text-sm text-muted-foreground">
                {t("multipleLocationsDescription")}
              </p>
            </div>
            <Checkbox
              checked={multipleLocationsEnabled}
              onCheckedChange={(checked) =>
                setMultipleLocationsEnabled(checked === true)
              }
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? <p className="text-sm text-muted-foreground">{t("saved")}</p> : null}

          <Button disabled={isSubmitting} type="submit">
            {t("save")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
