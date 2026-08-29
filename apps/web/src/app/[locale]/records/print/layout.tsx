import type { ReactNode } from "react";

/**
 * The report is its own document: white and black regardless of theme, because Chromium
 * strips backgrounds when printing and would otherwise leave dark-mode text invisible.
 */
export default function RecordsPrintLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto bg-white text-black print:h-auto print:overflow-visible">
      <div className="mx-auto w-full max-w-5xl px-6 py-6 print:max-w-none print:px-0 print:py-0">
        {children}
      </div>
    </div>
  );
}
