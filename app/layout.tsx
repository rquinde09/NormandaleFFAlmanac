import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { dateLabel } from "@/lib/format";
import { getLeague, latestSeason } from "@/lib/league";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "Normandale Nation", template: "%s · Normandale Nation" },
  description: "Standings, records and history of the Normandale Nation fantasy football league.",
  appleWebApp: { capable: true, title: "NCC" },
};

export const viewport: Viewport = { themeColor: "#09090b" };

export default function RootLayout({ children }: { children: ReactNode }) {
  const league = getLeague();
  const latest = latestSeason(league);
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh font-sans text-zinc-100 antialiased">
        <header className="sticky top-0 z-20 border-b border-zinc-900 bg-[#09090b]/90 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 pt-3 pb-2 md:flex md:items-center md:justify-between md:py-3">
            <Link href="/" className="text-lg font-bold tracking-tight text-zinc-50">
              Normandale Nation
            </Link>
            <div className="mt-2 md:mt-0">
              <Nav />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-8 text-xs text-zinc-500">
          Data from ESPN
          {league.updatedAt && ` · updated ${dateLabel(league.updatedAt)}`}
          {` · ${latest.season} ${latest.complete ? "final" : `through week ${latest.throughWeek}`}`}
        </footer>
      </body>
    </html>
  );
}
