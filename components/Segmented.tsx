"use client";

// `small` fits more options on a phone: smaller text and padding below the sm breakpoint
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  small = false,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  small?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl border border-zinc-800 bg-zinc-900 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg py-1.5 font-medium whitespace-nowrap transition-colors ${small ? "px-1 text-xs sm:px-2 sm:text-sm" : "px-2 text-sm"} ${
            o.value === value ? "bg-zinc-700 text-zinc-50" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
