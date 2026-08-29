"use client";

import type { OrganizationResponse } from "@haccp/shared";
import {
  ORGANIZATION_LOGO_ACCEPT,
  organizationResponseSchema,
  tenantContextResponseSchema,
  validateOrganizationLogoFile,
} from "@haccp/shared";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useAuthenticatedFetch } from "@/lib/api/client";
import { useApiErrorToast } from "@/lib/api/use-api-error-toast";

type OrganizationLogoUploadProps = {
  organization: OrganizationResponse;
};

function waitForImageLoad(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
    if (img.complete) {
      resolve();
    }
  });
}

function getOrganizationInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function OrganizationLogoUpload({
  organization,
}: OrganizationLogoUploadProps) {
  const t = useTranslations("SettingsPage");
  const { fetchJson } = useAuthenticatedFetch();
  const showApiError = useApiErrorToast();
  const { refreshTenant } = useTenant();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const awaitingDisplayedLogoRef = useRef(false);

  const displayImageUrl =
    previewUrl ?? (organization.hasImage ? organization.imageUrl : null);
  const isBusy = isUploading || isRemoving;

  function finishLogoUpload() {
    if (!awaitingDisplayedLogoRef.current) {
      return;
    }

    awaitingDisplayedLogoRef.current = false;
    setIsUploading(false);
    setPreviewUrl(null);
  }

  useEffect(() => {
    if (!awaitingDisplayedLogoRef.current || !displayImageUrl) {
      return;
    }

    const img = new Image();
    img.src = displayImageUrl;
    if (img.complete) {
      finishLogoUpload();
    }
  }, [displayImageUrl]);

  async function refreshOrganizationContext() {
    const tenant = await fetchJson(
      "/tenant/current",
      tenantContextResponseSchema,
    );
    refreshTenant(tenant);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const validationError = validateOrganizationLogoFile(file);

    if (validationError === "invalid_type") {
      toast.error(t("errors.invalidLogoType"));
      return;
    }

    if (validationError === "too_large") {
      toast.error(t("errors.logoTooLarge"));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const updated = await fetchJson(
        "/organizations/current/logo",
        organizationResponseSchema,
        {
          method: "PUT",
          body: formData,
        },
      );
      if (updated.hasImage) {
        await waitForImageLoad(updated.imageUrl);
      }
      await refreshOrganizationContext();
      awaitingDisplayedLogoRef.current = true;
      setPreviewUrl(updated.hasImage ? updated.imageUrl : null);
      toast.success(t("toast.logoSaved"));
    } catch (err) {
      awaitingDisplayedLogoRef.current = false;
      setPreviewUrl(null);
      showApiError(err);
    } finally {
      URL.revokeObjectURL(objectUrl);
      if (!awaitingDisplayedLogoRef.current) {
        setIsUploading(false);
      }
    }
  }

  async function handleRemove() {
    setIsRemoving(true);

    try {
      await fetchJson(
        "/organizations/current/logo",
        organizationResponseSchema,
        { method: "DELETE" },
      );
      await refreshOrganizationContext();
      setPreviewUrl(null);
      setRemoveDialogOpen(false);
      toast.success(t("toast.logoRemoved"));
    } catch (err) {
      showApiError(err);
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <FieldLabel>{t("logo")}</FieldLabel>

      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <Avatar className="size-16 rounded-lg after:rounded-lg">
            {displayImageUrl ? (
              <AvatarImage
                src={displayImageUrl}
                alt={organization.name}
                className="rounded-lg"
                onLoad={() => finishLogoUpload()}
              />
            ) : null}
            <AvatarFallback className="rounded-lg text-base">
              {getOrganizationInitials(organization.name)}
            </AvatarFallback>
          </Avatar>
          {isUploading ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              accept={ORGANIZATION_LOGO_ACCEPT}
              className="sr-only"
              disabled={isBusy}
              type="file"
              onChange={handleFileChange}
            />
            <Button
              disabled={isBusy}
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? t("logoUploading") : t("changeLogo")}
            </Button>
            {organization.hasImage ? (
              <Button
                disabled={isBusy}
                type="button"
                variant="ghost"
                onClick={() => setRemoveDialogOpen(true)}
              >
                {t("removeLogo")}
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
        </div>
      </div>

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeLogo")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeLogoConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>
              {t("removeLogoCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              isLoading={isRemoving}
              variant="destructive"
              onClick={handleRemove}
            >
              {t("removeLogoConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
