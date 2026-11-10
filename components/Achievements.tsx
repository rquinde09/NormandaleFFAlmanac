import { Card, SectionLabel } from "@/components/ui";
import type { Achievement } from "@/lib/manager";

// Earned once in any season lights the icon; otherwise it stays greyed out, so its shape still
// shows (the site owner, 2026-11-10)
export function Achievements({ list }: { list: Achievement[] }) {
  return (
    <section>
      <SectionLabel>Achievements</SectionLabel>
      <Card>
        <ul className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-8">
          {list.map((a) => (
            <li key={a.key} className="flex flex-col items-center text-center" title={a.detail}>
              <span className={`text-3xl leading-none ${a.earned ? "" : "opacity-20 grayscale"}`} aria-hidden>
                {a.icon}
              </span>
              <span className={`mt-1.5 text-[11px] leading-tight font-medium ${a.earned ? "text-zinc-200" : "text-zinc-600"}`}>
                {a.title}
              </span>
              <span className="sr-only">{a.earned ? "earned" : "not earned"}: {a.detail}</span>
              {a.earned && a.note && <span className="mt-0.5 text-[10px] leading-tight tabular-nums text-zinc-500">{a.note}</span>}
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
