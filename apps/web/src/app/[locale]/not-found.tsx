import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("Metadata");

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-muted-foreground">{t("title")}</p>
      <Link
        href="/"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        Home
      </Link>
    </div>
  );
}
