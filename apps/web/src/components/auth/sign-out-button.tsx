"use client";

import { useClerk } from "@clerk/nextjs";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { getClerkLocalePath } from "@/lib/clerk-localization";
import type { Locale } from "@/i18n/routing";

type Props = {
  label: string;
  testId?: string;
};

export function SignOutButton({ label, testId }: Props) {
  const { signOut } = useClerk();
  const locale = useLocale() as Locale;

  return (
    <Button
      variant="outline"
      data-testid={testId}
      onClick={() => {
        void signOut({ redirectUrl: getClerkLocalePath(locale, "/sign-in") });
      }}
    >
      {label}
    </Button>
  );
}
