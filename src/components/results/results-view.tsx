"use client";
import { ArrowLeft, Pencil, SearchX, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useMode } from "@/components/layout/mode-provider";
import { SchemeCard } from "@/components/results/scheme-card";
import { ButtonLink, ExternalLink, buttonClass } from "@/components/ui/button";
import { Notice, Panel } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { loadResults, type StoredResults } from "@/lib/client/session-store";
import { countByStatus, filterByScope, relevantStateFor, sortResults, type ScopeFilter, type SortKey } from "@/lib/matching/engine";
import { fieldsForNeed, optionsFor } from "@/lib/needs/registry";
import { INCOME_RANGES, stateName } from "@/lib/reference/india";
import { cn, formatInr } from "@/lib/utils/cn";

const RESULTS_KEY = "msf.results.v1";
const noopSubscribe = () => () => {};
function readRaw(): string | null {
  try {
    return window.sessionStorage.getItem(RESULTS_KEY);
  } catch {
    return null;
  }
}

export function ResultsView() {
  // Read once from this tab's session storage; the server never sees these inputs in a URL.
  const raw = useSyncExternalStore(noopSubscribe, readRaw, () => undefined);
  const stored = useMemo<StoredResults | null>(() => (raw ? loadResults() : null), [raw]);
  const { mode } = useMode();

  if (raw === undefined) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6" aria-busy="true">
        <p className="text-ink-soft">Loading results…</p>
      </div>
    );
  }
  if (!stored) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Panel className="space-y-4 text-center">
          <SearchX className="mx-auto size-10 text-muted" aria-hidden />
          <h1 className="text-2xl font-semibold">No search to show</h1>
          <p className="text-ink-soft">Results stay in the browser tab where you searched, and are cleared when you sign out or leave Open mode.</p>
          <ButtonLink href="/dashboard">Start a search</ButtonLink>
        </Panel>
      </div>
    );
  }
  return <Results stored={stored} modeMismatch={stored.mode !== mode} />;
}

function summaryChips(s: StoredResults): string[] {
  const c = s.criteria;
  const chips: string[] = [];
  chips.push(c.age !== null ? `Age ${c.age}` : "Age not given");
  chips.push(c.residenceState ? `Lives in ${stateName(c.residenceState)}` : "Residence not given");
  if (c.income.exactInr !== null) chips.push(`Income ${formatInr(c.income.exactInr)}`);
  else if (c.income.rangeId) chips.push(`Income ${INCOME_RANGES.find((r) => r.id === c.income.rangeId)?.label ?? ""}`);
  else chips.push("Income not given");
  chips.push(c.insurance.status === "yes" ? "Has insurance" : c.insurance.status === "no" ? "No insurance" : "Insurance not sure");
  for (const f of fieldsForNeed(s.needId)) {
    const v = c.needDetails[f.key];
    if (v && v !== "not_sure") {
      const label = optionsFor(f, c.needDetails).find((o) => o.value === v)?.label;
      if (label) chips.push(label);
    }
  }
  return chips;
}

function Results({ stored, modeMismatch }: { stored: StoredResults; modeMismatch: boolean }) {
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [sort, setSort] = useState<SortKey>("match");
  const [showFailing, setShowFailing] = useState(false);

  const state = relevantStateFor(stored.criteria);
  const counts = countByStatus(stored.results);
  const scoped = filterByScope(stored.results, scope, state);
  const failingInScope = scoped.filter((r) => r.overall === "does_not_match").length;
  const visible = sortResults(scoped, sort).filter((r) => showFailing || r.overall !== "does_not_match");
  const loc = stored.criteria.treatmentLocation;
  const locText =
    loc.source === "browser"
      ? `Your current location${loc.state ? ` (${stateName(loc.state)})` : ""}`
      : [loc.cityOrPin, loc.district, stateName(loc.state)].filter(Boolean).join(", ");

  const scopeTabs: { id: ScopeFilter; label: string }[] = [
    { id: "all", label: "All schemes" },
    { id: "national", label: "National" },
    { id: "state", label: state ? `State: ${stateName(state)}` : "State" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <Link href={`/search/${stored.needId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Back to search details
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold sm:text-4xl">Potential scheme results</h1>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
              <span className="inline-flex items-center gap-1.5">
                {stored.mode === "open" ? <Users className="size-4" aria-hidden /> : <UserRound className="size-4" aria-hidden />}
                {stored.mode === "open" ? "Open mode: for someone else" : "According to your profile"}
              </span>
              <span>Treatment near {locText || "not given"}</span>
            </p>
          </div>
          <Link href={`/search/${stored.needId}`} className={buttonClass("secondary", "sm")}>
            <Pencil className="size-4" aria-hidden /> Edit search
          </Link>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Search details used">
          {summaryChips(stored).map((c) => (
            <li key={c} className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-soft">
              {c}
            </li>
          ))}
        </ul>
        <p className="text-sm" aria-live="polite">
          <strong>{counts.potential_match}</strong> potential {counts.potential_match === 1 ? "match" : "matches"},{" "}
          <strong>{counts.needs_verification}</strong> needing more information or verification, and{" "}
          <strong>{counts.does_not_match}</strong> that don&apos;t meet a known criterion.
        </p>
      </header>

      {modeMismatch && (
        <Notice tone="warn" title={`These results were for ${stored.mode === "open" ? "someone else" : "your profile"}`}>
          You&apos;ve since switched modes. <Link href="/dashboard">Start a new search</Link> to search in the current mode.
        </Notice>
      )}
      {stored.historyWarning && <Notice tone="warn" title={stored.historyWarning} />}

      {stored.results.length === 0 ? (
        <NoConfirmedMatch stored={stored} />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Filter by scheme type" className="flex flex-wrap gap-1">
              {scopeTabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={scope === t.id}
                  onClick={() => setScope(t.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium",
                    scope === t.id ? "bg-ink text-white" : "text-ink-soft hover:bg-paper hover:text-ink",
                  )}
                >
                  {t.label} <span className="opacity-70">({filterByScope(stored.results, t.id, state).length})</span>
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="whitespace-nowrap text-muted">Sort by</span>
              <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="py-1.5">
                <option value="match">Strongest match</option>
                <option value="benefit">Documented benefit ceiling</option>
                <option value="type">National first</option>
                <option value="hospitals">Most listed hospitals</option>
                <option value="verification">Most verified data</option>
              </Select>
            </label>
          </div>

          {visible.length === 0 ? (
            <Panel className="space-y-2">
              <h2 className="text-lg font-semibold">
                {scope === "state"
                  ? state
                    ? `No state schemes for ${stateName(state)} in our dataset for this need`
                    : "Choose a state to see state schemes"
                  : "Nothing to show with this filter"}
              </h2>
              <p className="text-sm text-ink-soft">
                {failingInScope > 0
                  ? `${failingInScope} scheme${failingInScope === 1 ? "" : "s"} here don't meet a known criterion.`
                  : "That doesn't mean none exist — our dataset is small and only includes schemes we could trace to official sources."}
              </p>
              {failingInScope > 0 && (
                <button type="button" className="text-sm font-medium text-teal underline" onClick={() => setShowFailing(true)}>
                  Show them anyway
                </button>
              )}
            </Panel>
          ) : (
            <ul className="space-y-4">
              {visible.map((r) => (
                <li key={r.scheme.id}>
                  <SchemeCard result={r} searchId={stored.searchId} />
                </li>
              ))}
            </ul>
          )}

          {failingInScope > 0 && (
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="size-4 accent-[var(--teal)]" checked={showFailing} onChange={(e) => setShowFailing(e.target.checked)} />
              Show schemes that don&apos;t meet a known criterion ({failingInScope})
            </label>
          )}
          <ResourceList stored={stored} />
        </>
      )}

      <p className="text-xs text-muted">
        Results from reference data version {stored.referenceVersion}. Eligibility is decided by the scheme and the hospital, not by this
        tool. This is not medical advice.
      </p>
    </div>
  );
}

function ResourceList({ stored }: { stored: StoredResults }) {
  if (stored.officialResources.length === 0) return null;
  return (
    <Panel className="space-y-3">
      <h2 className="text-lg font-semibold">Official places to check</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {stored.officialResources.map((r) => (
          <li key={r.url}>
            <ExternalLink href={r.url} className="text-sm font-medium text-teal hover:underline">
              {r.label}
            </ExternalLink>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function NoConfirmedMatch({ stored }: { stored: StoredResults }) {
  return (
    <div className="space-y-4">
      <Panel className="space-y-2">
        <h2 className="text-xl font-semibold">No confirmed match in our dataset</h2>
        <p className="text-ink-soft">
          We couldn&apos;t find a scheme we can trace to an official source for this search. That doesn&apos;t mean help doesn&apos;t exist —
          ask the hospital&apos;s medical social worker or scheme desk, and check the official resources below.
        </p>
      </Panel>
      <ResourceList stored={stored} />
    </div>
  );
}
