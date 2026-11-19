import {
  ArrowRightIcon,
  FileCheck2Icon,
  GaugeIcon,
  HistoryIcon,
  LanguagesIcon,
  ListChecksIcon,
  type LucideIcon,
  MapPinIcon,
  PrinterIcon,
  SmartphoneIcon,
  SnowflakeIcon,
  ThermometerIcon,
  TruckIcon,
  UsersIcon,
  WrenchIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LandingHeader } from "./components/landing-header";
import { Logo } from "./components/logo";
import { RecordsPreview } from "./components/records-preview";
import { Eyebrow, SectionHeading } from "./components/section-heading";
import { TodayPreview } from "./components/today-preview";
import { geist, geistMono } from "./lib/fonts";
import kitchenCheck from "./assets/kitchen-check.jpg";

const checkpoints = [
  { icon: ThermometerIcon, key: "fridges" },
  { icon: SnowflakeIcon, key: "freezers" },
  { icon: TruckIcon, key: "goodsIn" },
  { icon: GaugeIcon, key: "hotHolding" },
  { icon: ListChecksIcon, key: "cleaning" },
  { icon: WrenchIcon, key: "equipment" },
] as const satisfies readonly { icon: LucideIcon; key: string }[];

const steps = ["map", "build", "today"] as const;

const features = [
  { icon: MapPinIcon, key: "sites" },
  { icon: UsersIcon, key: "roles" },
  { icon: SmartphoneIcon, key: "install" },
  { icon: LanguagesIcon, key: "languages" },
] as const satisfies readonly { icon: LucideIcon; key: string }[];

const inspectionPoints = [
  { icon: FileCheck2Icon, key: "timing" },
  { icon: PrinterIcon, key: "print" },
  { icon: HistoryIcon, key: "history" },
] as const satisfies readonly { icon: LucideIcon; key: string }[];

const faqItems = [
  "install",
  "ownChecks",
  "outOfRange",
  "sites",
  "inspection",
] as const;

export function LandingView() {
  const t = useTranslations("Landing");

  return (
    // The locale layout is a fixed-height shell, so the landing page owns its own scroll.
    <div
      className={cn(
        geist.variable,
        geistMono.variable,
        "flex-1 overflow-x-hidden overflow-y-auto scroll-smooth font-display",
      )}
    >
      <LandingHeader />

      <main>
        <section className="relative bg-logbook">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
          <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-14 px-4 pt-16 pb-20 sm:px-5 md:pt-24 lg:grid-cols-[1.1fr_1fr]">
            <div className="@container motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
              <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 font-mono text-xs tracking-[0.14em] text-muted-foreground uppercase">
                <span className="size-1.5 rounded-full bg-success" />
                {t("hero.badge")}
              </p>
              <h1 className="mt-6 text-[clamp(2.25rem,10cqi,3.75rem)] leading-[1.05] font-bold tracking-tight">
                {t("hero.titleLine1")}
                <br />
                <span className="text-primary dark:text-chart-2">
                  {t("hero.titleLine2")}
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-lg text-muted-foreground md:text-xl">
                {t("hero.body")}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  className="h-12 px-6 text-base has-data-[icon=inline-end]:pr-6"
                  data-testid="landing-get-started"
                  nativeButton={false}
                  render={<Link href="/sign-up" />}
                >
                  {t("hero.primaryCta")}
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 px-6 text-base"
                  nativeButton={false}
                  render={<a href="#how" />}
                >
                  {t("hero.secondaryCta")}
                </Button>
              </div>
            </div>
            <div className="flex justify-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:delay-150 motion-safe:duration-700 motion-safe:fill-mode-both lg:justify-end">
              <TodayPreview />
            </div>
          </div>
        </section>

        <section
          aria-label={t("checkpoints.label")}
          className="border-y bg-card"
        >
          <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 py-6 sm:px-5">
            {checkpoints.map(({ icon: Icon, key }) => (
              <li
                key={key}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Icon className="size-4 text-primary" />
                {t(`checkpoints.${key}`)}
              </li>
            ))}
          </ul>
        </section>

        <section
          id="how"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-5 md:py-32"
        >
          <SectionHeading eyebrow={t("how.eyebrow")} title={t("how.title")} />
          <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step} className="bg-card p-8">
                <span className="font-mono text-sm text-primary dark:text-chart-2">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-6 text-2xl font-semibold tracking-tight">
                  {t(`how.steps.${step}.title`)}
                </h3>
                <p className="mt-3 text-muted-foreground">
                  {t(`how.steps.${step}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* `dark` makes this band a dark island in both themes. */}
        <section
          id="features"
          className="dark scroll-mt-20 bg-card py-24 text-foreground md:py-32"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-5">
            <div className="grid items-end gap-10 lg:grid-cols-2">
              <div>
                <Eyebrow className="text-muted-foreground">
                  {t("features.eyebrow")}
                </Eyebrow>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance md:text-5xl">
                  {t("features.title")}
                </h2>
              </div>
              <p className="text-lg text-muted-foreground">
                {t("features.body")}
              </p>
            </div>

            <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border lg:aspect-auto">
                <Image
                  src={kitchenCheck}
                  alt={t("features.photoAlt")}
                  fill
                  placeholder="blur"
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="object-cover object-[60%_40%]"
                />
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {features.map(({ icon: Icon, key }) => (
                  <li key={key} className="rounded-2xl border p-7">
                    <Icon className="size-6 text-chart-1" />
                    <h3 className="mt-5 text-xl font-semibold tracking-tight">
                      {t(`features.${key}.title`)}
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      {t(`features.${key}.body`)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          id="inspections"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-5 md:py-32"
        >
          <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-14 lg:grid-cols-[1fr_1.15fr]">
            <div>
              <SectionHeading
                eyebrow={t("inspections.eyebrow")}
                title={t("inspections.title")}
                body={t("inspections.body")}
              />
              <ul className="mt-8 space-y-4">
                {inspectionPoints.map(({ icon: Icon, key }) => (
                  <li key={key} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary dark:text-chart-2">
                      <Icon className="size-4" />
                    </span>
                    <span className="pt-1">
                      {t(`inspections.points.${key}`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <RecordsPreview />
          </div>
        </section>

        <section
          id="faq"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24 sm:px-5 md:pb-32"
        >
          <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[1fr_1.5fr]">
            <SectionHeading eyebrow={t("faq.eyebrow")} title={t("faq.title")} />
            <Accordion className="rounded-2xl border bg-card px-6">
              {faqItems.map((item) => (
                <AccordionItem key={item} value={item}>
                  <AccordionTrigger className="py-5 text-base">
                    {t(`faq.items.${item}.question`)}
                  </AccordionTrigger>
                  <AccordionContent className="text-base text-muted-foreground">
                    {t(`faq.items.${item}.answer`)}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-5">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-primary px-8 py-16 text-primary-foreground md:px-16 md:py-20">
            <div className="absolute inset-0 bg-logbook opacity-40" />
            <div className="relative max-w-2xl">
              <h2 className="text-4xl font-bold tracking-tight text-balance md:text-6xl">
                {t("cta.title")}
              </h2>
              <p className="mt-5 text-lg text-primary-foreground/80">
                {t("cta.body")}
              </p>
              <Button
                size="lg"
                className="mt-9 h-12 bg-background px-6 text-base text-foreground has-data-[icon=inline-end]:pr-6 hover:bg-background/90"
                nativeButton={false}
                render={<Link href="/sign-up" />}
              >
                {t("cta.button")}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:px-5 md:flex-row">
          <Logo className="text-foreground" />
          <p>{t("footer.tagline")}</p>
          <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
        </div>
      </footer>
    </div>
  );
}
