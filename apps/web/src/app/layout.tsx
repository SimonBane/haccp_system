import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

/*
 * Marks an iOS home-screen app for `--app-viewport-height`, which switches the
 * shell off `dvh` — a unit WebKit reports short of the covered screen there.
 *
 * Inline and first in the body so the attribute lands before anything paints;
 * an effect would show the shell one frame short of the screen on every cold
 * start. `navigator.standalone` rather than the `display-mode` media query
 * that globals.css also matches: on iOS only the property is dependable, and
 * it is never true in a browser tab, so the two cannot disagree in a way that
 * costs a tab its `dvh`.
 */
const STANDALONE_FLAG = `if(navigator.standalone)document.documentElement.dataset.standalone=""`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="bg"
      // Height lives in globals.css, where `html` is sized from
      // `--app-viewport-height`. A Tailwind `h-full` here would win the
      // cascade and resolve against the layout viewport instead, which is not
      // the same box in either a browser tab or an installed app.
      className={cn("antialiased", "font-sans", inter.variable)}
      suppressHydrationWarning
    >
      <body className="flex flex-col font-sans">
        <script dangerouslySetInnerHTML={{ __html: STANDALONE_FLAG }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
