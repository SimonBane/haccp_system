"use client";

import { SignInButton, Show, UserButton } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";

export function HomeAuthControls() {
  const t = useTranslations("HomePage");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className={buttonVariants({ variant: "outline" })}>
            {t("signIn")}
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
        <Link href="/dashboard" className={buttonVariants()}>
          {t("openDashboard")}
        </Link>
      </Show>
    </div>
  );
}
