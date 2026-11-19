import { PrinterIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Timing = "onTime" | "late" | "missed";

const records: {
  key:
    "fridgeMorning" | "goodsIn" | "hotHolding" | "cleaning" | "fridgeEvening";
  time: string;
  timing: Timing;
  result?: "pass" | "fail";
}[] = [
  { key: "fridgeMorning", time: "06:02", timing: "onTime", result: "pass" },
  { key: "goodsIn", time: "08:41", timing: "late", result: "fail" },
  { key: "hotHolding", time: "11:00", timing: "onTime", result: "pass" },
  { key: "cleaning", time: "14:00", timing: "missed" },
  { key: "fridgeEvening", time: "18:05", timing: "onTime", result: "pass" },
];

const timingClass: Record<Timing, string> = {
  onTime: "text-muted-foreground",
  late: "text-warning",
  missed: "text-destructive",
};

export function RecordsPreview() {
  const t = useTranslations("Landing.inspections.records");

  return (
    <figure
      aria-label={t("label")}
      className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-float"
    >
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <p className="font-semibold">{t("title")}</p>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium">
          <PrinterIcon className="size-3.5" /> {t("print")}
        </span>
      </div>
      <Table>
        <TableHeader className="bg-muted text-xs">
          <TableRow>
            <TableHead className="px-3 sm:px-5">
              {t("columns.dateTime")}
            </TableHead>
            <TableHead className="px-3 sm:px-5">{t("columns.task")}</TableHead>
            <TableHead className="hidden px-3 sm:table-cell sm:px-5">
              {t("columns.timing")}
            </TableHead>
            <TableHead className="px-3 sm:px-5">
              {t("columns.result")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((record) => (
            <TableRow key={record.key}>
              <TableCell className="px-3 font-mono text-xs text-muted-foreground sm:px-5">
                <span className="block sm:inline">{t("date")}</span>
                <span className="hidden sm:inline"> · </span>
                <span className="block sm:inline">{record.time}</span>
              </TableCell>
              <TableCell className="px-3 whitespace-normal sm:px-5">
                {t(`rows.${record.key}`)}
                <span
                  className={cn(
                    "mt-0.5 block text-xs sm:hidden",
                    timingClass[record.timing],
                  )}
                >
                  {t(`timing.${record.timing}`)}
                </span>
              </TableCell>
              <TableCell
                className={cn(
                  "hidden px-3 text-xs sm:table-cell sm:px-5",
                  timingClass[record.timing],
                )}
              >
                {t(`timing.${record.timing}`)}
              </TableCell>
              <TableCell className="px-3 sm:px-5">
                {record.result ? (
                  <Badge
                    variant={record.result === "pass" ? "success" : "warning"}
                  >
                    {t(`result.${record.result}`)}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t("result.none")}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </figure>
  );
}
