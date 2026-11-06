// Page state that lives in the URL (sort, filters, view). Updating history directly keeps changes
// instant; Next.js keeps useSearchParams in sync. Start from the live URL, not a render's params,
// so quick successive changes all stick. Empty or null removes a parameter.
export function updateParams(pathname: string, next: Record<string, string | null>) {
  const p = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(next)) {
    if (v === null || v === "") p.delete(k);
    else p.set(k, v);
  }
  const s = p.toString();
  window.history.replaceState(null, "", s ? `${pathname}?${s}` : pathname);
}
