import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

/** Every non-report outcome renders here — a partial table is never an option. */
export function ReportNotice({
  title,
  description,
  backLabel,
  backHref,
}: {
  title: string;
  description: string;
  backLabel: string;
  backHref: string;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-3 py-16">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm">{description}</p>
      <Button
        variant="outline"
        render={<Link href={backHref} />}
        nativeButton={false}
        className="print:hidden"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        {backLabel}
      </Button>
    </div>
  );
}
