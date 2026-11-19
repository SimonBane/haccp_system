import { Geist, Geist_Mono } from "next/font/google";

// Lovable's display face (Bricolage Grotesque) has no Cyrillic, and bg is the default locale.
export const geist = Geist({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist",
});

export const geistMono = Geist_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-mono",
});
