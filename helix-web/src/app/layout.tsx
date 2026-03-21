import type { Metadata } from "next";
import "./globals.css";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "P&L and Risk Analytical Dashboard",
  description: "Helix front-office event-driven platform web application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" data-theme="helix">
      <body className="overflow-hidden border-0 text-[var(--color-text)] [background:var(--color-bg)]">
        <div
          id="app-scroll"
          className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden"
        >
          <Header />
          <main className="min-h-0 flex-1 overflow-auto px-[5vw] py-5">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
