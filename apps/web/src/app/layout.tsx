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
      // Height lives in globals.css (`-webkit-fill-available` / dvh). A
      // Tailwind `h-full` here would win the cascade and recreate the iOS
      // PWA short-viewport gap above the home indicator.
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
