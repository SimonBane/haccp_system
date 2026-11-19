import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { LocaleToggle } from "./locale-toggle";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const sections = ["how", "features", "inspections", "faq"] as const;

export function LandingHeader() {
  const t = useTranslations("Landing.nav");

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-5">
        <Link
          href="/"
          aria-label={t("home")}
          className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>
        <nav
          aria-label={t("label")}
          className="hidden items-center gap-8 text-sm text-muted-foreground md:flex"
        >
          {sections.map((section) => (
            <a
              key={section}
              href={`#${section}`}
              className="transition-colors hover:text-foreground"
            >
              {t(section)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LocaleToggle />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            data-testid="landing-sign-in"
            nativeButton={false}
            render={<Link href="/sign-in" />}
          >
            {t("signIn")}
          </Button>
        </div>
      </div>
    </header>
  );
}
