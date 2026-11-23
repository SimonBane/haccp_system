"use client";

import { ArrowLeftIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { MobileHeaderTitle } from "@/components/layout/shell-slots";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "@/i18n/navigation";

const FORMS_PATH = "/dashboard/forms";

/** Header of the starting-point picker; the builder that follows has its own. */
export function CreateHeader() {
  const t = useTranslations("FormsPage.create");
  const tBuilder = useTranslations("FormsPage.builder");
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        <MobileHeaderTitle>{t("title")}</MobileHeaderTitle>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 self-start"
          render={<Link href={FORMS_PATH} />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {tBuilder("backToForms")}
        </Button>
      </>
    );
  }

  return (
    <header className="-mx-4 flex items-center justify-between gap-3 border-b px-4 py-3 sm:-mx-6 sm:px-6">
      <span className="font-semibold">{t("title")}</span>
      <Button
        variant="ghost"
        size="icon"
        render={<Link href={FORMS_PATH} />}
        nativeButton={false}
        aria-label={t("close")}
      >
        <XIcon />
      </Button>
    </header>
  );
}
