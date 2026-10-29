import { brand } from "@/config/brand";

/** Logo mark: a folded form with a check — replace freely. */
export function Logo({ withName = true }: { withName?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect x="5" y="3" width="22" height="26" rx="4" fill="var(--ink)" />
        <path d="M21 3h2a4 4 0 0 1 4 4v2h-6z" fill="var(--teal)" />
        <path d="m10.5 17 3.6 3.6 7.4-7.6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {withName && <span className="font-display text-[1.15rem] font-semibold tracking-tight text-ink">{brand.name}</span>}
    </span>
  );
}
