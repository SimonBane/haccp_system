import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="bg"
      // Height lives in globals.css, where `html` is sized in dvh. A Tailwind
      // `h-full` here would win the cascade and resolve against the layout
      // viewport instead, which is taller than what the user can see.
      className={cn("antialiased", "font-sans", inter.variable)}
      suppressHydrationWarning
    >
      <body className="flex flex-col font-sans">
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
