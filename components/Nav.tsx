"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/standings", label: "Standings" },
  { href: "/teams", label: "Teams" },
  { href: "/records", label: "Records" },
  { href: "/hall-of-mahaan-bakaree", label: "Champions" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    // Tighter on phones so all five tabs fit a 375px screen
    <nav className="no-scrollbar -mx-4 flex gap-0.5 overflow-x-auto px-4 sm:gap-1">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`shrink-0 rounded-lg px-1.5 py-1.5 text-[13px] font-medium transition-colors sm:px-2.5 sm:text-sm ${
              active ? "bg-zinc-800 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
