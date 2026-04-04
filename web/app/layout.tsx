import type { Metadata } from "next";
import { Geist, Geist_Mono, Open_Sans } from "next/font/google";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { QueryProvider } from "@/components/query-provider";
import { StrategyProvider } from "@/components/strategy-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  weight: ["300", "400"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Helix",
  description: "Default Next.js web app scaffold for the Helix platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${openSans.variable} h-full antialiased`}
      data-theme="helix"
    >
      <body className="overflow-hidden border-0 text-[var(--color-text)] [background:var(--color-bg)]">
        <QueryProvider>
          <StrategyProvider>
            <div
              id="app-scroll"
              className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden"
            >
              <SiteHeader />
              <main className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-6 lg:px-[5vw]">
                {children}
              </main>
            </div>
          </StrategyProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
