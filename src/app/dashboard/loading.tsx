export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-10 sm:px-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-9 w-2/3 animate-pulse rounded-lg bg-line" />
      <div className="h-4 w-1/2 animate-pulse rounded bg-line" />
      <div className="h-48 animate-pulse rounded-2xl bg-line/60" />
    </div>
  );
}
