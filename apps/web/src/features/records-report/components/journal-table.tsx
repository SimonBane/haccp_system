import {
  BanIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleDashedIcon,
  CircleMinusIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ReportStatus } from "../lib/report-rows";

/** Shared look of every journal table, so a binder reads as one document. */
export const journalTable = {
  frame:
    "overflow-hidden rounded-xl border break-inside-avoid-page [--report-ink:color-mix(in_oklch,var(--success)_70%,black)]",
  table:
    "w-full table-fixed border-collapse text-left text-[12.5px] leading-[18px] tabular-nums",
  head: "bg-success/12 px-3 pt-2 pb-1.5 align-bottom text-xs font-semibold text-(--report-ink)",
  norm: "bg-success/12 px-3 pb-2 text-xs font-semibold whitespace-nowrap text-(--report-ink)",
  cell: "border-b px-3 py-1.5 align-top",
  shaded: "bg-success/[0.04]",
  note: "text-xs leading-[17px]",
  by: "text-xs leading-[17px] text-muted-foreground",
} as const;

/** The band naming what the table is for, so a page of tables never needs reading twice. */
export function JournalTableFrame({
  title,
  aside,
  children,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={journalTable.frame}>
      <table className={journalTable.table}>
        {title === undefined ? null : (
          <caption className="caption-top bg-(--report-ink) px-3 py-2.5 text-left text-white">
            <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-base leading-6 font-semibold tracking-tight">
                {title}
              </span>
              {aside === undefined ? null : (
                <span className="text-xs font-medium opacity-90">{aside}</span>
              )}
            </span>
          </caption>
        )}
        {children}
      </table>
    </div>
  );
}

export function FailValue({ children }: { children: ReactNode }) {
  return (
    <span className="-mx-1.5 inline-block rounded-md bg-destructive/15 px-1.5 font-semibold text-destructive">
      {children}
    </span>
  );
}

export function JournalTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full border px-1.5 text-xs leading-4 font-normal text-muted-foreground">
      {children}
    </span>
  );
}

/** A check with no answer to show: missed, or still open when the report was made. */
export function UnansweredTag({ status }: { status: "missed" | "open" }) {
  const t = useTranslations("RecordsReportPage");
  const Icon = status === "missed" ? CircleMinusIcon : CircleDashedIcon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full py-px pr-2 pl-1.5 text-xs font-medium",
        status === "missed" ? "bg-warning/25" : "bg-muted",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {t(`status.${status}`)}
    </span>
  );
}

const STATUS_ICON = {
  done: CheckIcon,
  fail: CircleAlertIcon,
  missed: CircleMinusIcon,
  open: CircleDashedIcon,
  voided: BanIcon,
} as const;

export function StatusMark({ status }: { status: ReportStatus }) {
  const t = useTranslations("RecordsReportPage");
  if (status === "missed" || status === "open") {
    return <UnansweredTag status={status} />;
  }
  const Icon = STATUS_ICON[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium whitespace-nowrap",
        status === "fail" && "font-semibold text-destructive",
        status === "voided" && "text-muted-foreground",
      )}
    >
      <Icon
        className={cn("size-3.5", status === "done" && "text-success")}
        strokeWidth={2.5}
        aria-hidden
      />
      {t(`status.${status}`)}
    </span>
  );
}
