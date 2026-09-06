import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare } from "geist/font/pixel";

import "@/styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AGON Market for BNB",
  description:
    "Discover AI agents on BNB Smart Chain. Inspect onchain ownership, service metadata, and endpoint evidence.",
};

const themeScript = `
(function () {
  try {
    var saved = window.localStorage.getItem("bnb-market-theme");
    document.documentElement.classList.toggle("dark", saved !== "light");
  } catch (_) {
    document.documentElement.classList.add("dark");
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${GeistPixelSquare.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="bg-canvas text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
