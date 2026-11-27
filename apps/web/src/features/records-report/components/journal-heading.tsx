import { useTranslations } from "next-intl";

export function JournalHeading(props: {
  name: string;
  /** "Organization · Location · Period", repeated so a filed page stands on its own. */
  context: string;
  entryCount: number;
}) {
  const t = useTranslations("RecordsReportPage.journal");

  return (
    <header className="mb-6">
      <h2 className="text-2xl leading-[30px] font-semibold tracking-tight">
        {props.name}
      </h2>
      <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">
        {`${props.context} · ${t("entryCount", { count: props.entryCount })}`}
      </p>
    </header>
  );
}
