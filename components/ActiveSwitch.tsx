"use client";

// The "Active only" checkbox on the standings and records pages
export function ActiveSwitch({ checked, onChange }: { checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-red-500" />
      Active
    </label>
  );
}
