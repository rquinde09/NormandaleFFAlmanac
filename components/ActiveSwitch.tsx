"use client";

// A labeled checkbox in a small box: "Active" on the standings, records and manager pages, and
// "Compact" on the standings
export function CheckSwitch({ label, checked, onChange, className = "" }: { label: string; checked: boolean; onChange: (on: boolean) => void; className?: string }) {
  return (
    <label className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 ${className}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-red-500" />
      {label}
    </label>
  );
}

export function ActiveSwitch({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return <CheckSwitch label="Active" checked={checked} onChange={onChange} />;
}
