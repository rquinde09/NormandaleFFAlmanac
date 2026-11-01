export const pts = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const score = (n: number) => n.toFixed(2);

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${pts(Math.abs(n))}`;

export const record = (t: { w: number; l: number; t: number }) => (t.t ? `${t.w}-${t.l}-${t.t}` : `${t.w}-${t.l}`);

export const stars = (n: number) => "★".repeat(n);

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Chicago",
  });
}
