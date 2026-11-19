import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MapPinIcon,
  ThermometerIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Eyebrow } from "./section-heading";
import { cn } from "@/lib/utils";

type RowState = "pass" | "fail" | "due" | "later";

const rows: {
  key: "fridge" | "freezer" | "goodsIn" | "hotHolding" | "cleaning";
  time: string;
  state: RowState;
  reading?: number;
}[] = [
  { key: "fridge", time: "06:00", state: "pass", reading: 3.2 },
  { key: "freezer", time: "06:00", state: "pass", reading: -19.5 },
  { key: "goodsIn", time: "08:30", state: "fail", reading: 9.1 },
  { key: "hotHolding", time: "11:00", state: "due" },
  { key: "cleaning", time: "14:00", state: "later" },
];

const TOTAL = 12;
const COMPLETED = 7;
const NEEDS_ATTENTION = 1;
const NOW_BEFORE_INDEX = rows.findIndex((row) => row.state === "due");

function StateMark({ state }: { state: RowState }) {
  if (state === "pass") {
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
        <CheckIcon className="size-3.5" strokeWidth={3} />
      </span>
    );
  }
  if (state === "fail") {
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-warning text-warning-foreground">
        <AlertTriangleIcon className="size-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "size-6 shrink-0 rounded-full border-2",
        state === "due" ? "border-primary" : "border-border",
      )}
    />
  );
}

export function TodayPreview() {
  const t = useTranslations("Landing.preview");
  const format = useFormatter();

  return (
    <figure
      aria-label={t("label")}
      className="w-full max-w-md rounded-3xl border bg-card p-5 text-card-foreground shadow-float"
    >
      <div className="flex items-center justify-between">
        <div>
          <Eyebrow className="text-muted-foreground">{t("today")}</Eyebrow>
          <p className="mt-0.5 text-xl font-semibold tracking-tight">
            {t("date")}
          </p>
        </div>
        <div
          aria-hidden
          className="flex items-center gap-1 text-muted-foreground"
        >
          <ChevronLeftIcon className="size-5" />
          <ChevronRightIcon className="size-5" />
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
        <MapPinIcon className="size-3.5" /> {t("location")}
      </p>

      <div className="mt-4">
        <div className="flex justify-between gap-2 text-sm">
          <span className="font-medium">
            {t("progress", { completed: COMPLETED, total: TOTAL })}
          </span>
          <span className="text-warning">
            {t("attention", { count: NEEDS_ATTENTION })}
          </span>
        </div>
        <div
          aria-hidden
          className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="bg-success"
            style={{
              width: `${((COMPLETED - NEEDS_ATTENTION) / TOTAL) * 100}%`,
            }}
          />
          <div
            className="bg-warning"
            style={{ width: `${(NEEDS_ATTENTION / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      <ol className="mt-5 space-y-2">
        {rows.map((row, index) => (
          <li key={row.key}>
            {index === NOW_BEFORE_INDEX && (
              <div className="my-3 flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                <span className="font-mono text-xs font-medium text-primary">
                  {t("now", { time: "10:42" })}
                </span>
                <span className="h-px flex-1 bg-primary/40" />
              </div>
            )}
            <div
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3",
                row.state === "fail" && "border-warning/40 bg-warning/10",
                row.state === "due" && "border-primary/30 bg-primary/10",
                row.state === "later" && "opacity-60",
              )}
            >
              <StateMark state={row.state} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {t(`rows.${row.key}.task`)}
                  </p>
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.time}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {t(`rows.${row.key}.target`)}
                </p>
                {row.key === "goodsIn" && (
                  <p className="mt-1.5 text-xs text-foreground/80">
                    {t("rows.goodsIn.note")}
                  </p>
                )}
              </div>
              {row.reading !== undefined && (
                <span className="flex shrink-0 items-center gap-1 font-mono text-sm font-medium whitespace-nowrap">
                  <ThermometerIcon className="size-3.5 text-muted-foreground" />
                  {format.number(row.reading, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}{" "}
                  °C
                </span>
              )}
              {row.state === "due" && (
                <span className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                  {t("record")}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </figure>
  );
}
