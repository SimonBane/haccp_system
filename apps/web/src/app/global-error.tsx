"use client";

import { reportUnexpectedWebError } from "@/lib/api/error-reporting";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (!error.digest) {
      reportUnexpectedWebError(error);
    }
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
