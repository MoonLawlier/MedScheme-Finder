"use client";
import {
  Building2,
  ChevronDown,
  ExternalLink as ExternalIcon,
  FileCheck2,
  Landmark,
  MapPin,
  Phone,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { recordSchemeInteraction } from "@/app/actions/search";
import { ExternalLink, buttonClass } from "@/components/ui/button";
import { OverallStamp, RuleStamp, Tag } from "@/components/ui/feedback";
import { criterionLabel, mechanismLabel, recipientLabel, verificationLabel } from "@/components/results/labels";
import { SourceTag } from "@/components/results/source-tag";
import { stateName } from "@/lib/reference/india";
import type { RankedHospital, SchemeResult, Source } from "@/lib/types";
import { cn, formatDate, formatInrShort, safeExternalUrl } from "@/lib/utils/cn";

function Section({ title, icon, children, defaultOpen = true }: { title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-t border-line py-4 first:border-t-0">
      <summary className="flex items-center justify-between gap-3 rounded-md">
        <h3 className="flex items-center gap-2 font-sans text-base font-semibold">
          {icon}
          {title}
        </h3>
        <ChevronDown className="chevron size-4 text-muted transition-transform" aria-hidden />
      </summary>
      <div className="mt-3 space-y-3 text-sm">{children}</div>
    </details>
  );
}

export function SchemeCard({ result, searchId }: { result: SchemeResult; searchId: string | null }) {
  const { scheme } = result;
  const [open, setOpen] = useState(false);
  const recorded = useRef(false);
  const panelId = useId();
  const sources = useMemo(() => new Map<string, Source>(result.sources.map((s) => [s.id, s])), [result.sources]);
  const officialCount = result.sources.filter((s) => s.sourceType !== "news_report").length;

  const toggle = () => {
    setOpen((o) => !o);
    if (!recorded.current) {
      recorded.current = true;
      void recordSchemeInteraction({ schemeId: scheme.id, searchId, action: "opened" });
    }
  };

  const groups = new Set(result.evaluations.filter((e) => e.anyOfGroup).map((e) => e.anyOfGroup));
  const applyUrl = scheme.applicationUrlStatus !== "not_verified" ? safeExternalUrl(scheme.applicationUrl) : null;
  const infoUrl = safeExternalUrl(scheme.infoUrl);
  const directoryUrl = safeExternalUrl(scheme.hospitalDirectoryUrl);

  return (
    <article className="rounded-2xl border border-line bg-surface" aria-labelledby={`${panelId}-title`}>
      <div className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Tag className={scheme.scope === "national" ? "" : "border-info/30 bg-info-wash text-info"}>
            {scheme.scope === "national" ? "National" : `State: ${scheme.applicableStates.map(stateName).join(", ")}`}
          </Tag>
          <OverallStamp status={result.overall} />
        </div>
        <div className="space-y-1">
          <h2 id={`${panelId}-title`} className="text-xl font-semibold sm:text-[1.35rem]">
            {scheme.officialName}
          </h2>
          <p className="max-w-prose text-[0.95rem] text-ink-soft">{scheme.summary}</p>
        </div>
        <p className="text-sm">
          <span className="font-semibold">Why: </span>
          {result.summaryReason}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted">
            <FileCheck2 className="size-3.5" aria-hidden />
            <span>
              {verificationLabel[scheme.verificationStatus]}. {officialCount} official {officialCount === 1 ? "source" : "sources"}, checked{" "}
              {formatDate(scheme.lastVerifiedOn)}.
            </span>
          </p>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={panelId}
            className={buttonClass(open ? "secondary" : "primary", "sm")}
          >
            {open ? "Hide details" : "Show details"}
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        </div>
      </div>

      {open && (
        <div id={panelId} className="border-t border-line px-5 pb-2 sm:px-6">
          <Section title="Overview" icon={<Landmark className="size-4 text-teal" aria-hidden />}>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[11rem_1fr]">
              <dt className="font-medium text-muted">Issued by</dt>
              <dd>{scheme.issuingAuthority}</dd>
              <dt className="font-medium text-muted">Scope</dt>
              <dd>{scheme.scope === "national" ? "All of India" : scheme.applicableStates.map(stateName).join(", ")}</dd>
              <dt className="font-medium text-muted">Intended for</dt>
              <dd>{scheme.intendedBeneficiaries}</dd>
              <dt className="font-medium text-muted">Condition or treatment</dt>
              <dd className="space-y-1">
                <p>{result.treatment.coverageNote}</p>
                <SourceTag sourceId={result.treatment.sourceId} sources={sources} />
              </dd>
            </dl>
          </Section>

          <Section title="Eligibility criteria" icon={<FileCheck2 className="size-4 text-teal" aria-hidden />}>
            <p className="text-muted">
              Each documented rule, checked against the details entered. A scheme decides eligibility; this is not a decision.
            </p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {result.evaluations.map((e) => (
                <li key={e.ruleId} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:gap-4">
                  <div className="space-y-1.5">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{criterionLabel[e.criterion]}</span>
                      {!e.mandatory && <Tag>For information</Tag>}
                      {e.anyOfGroup && groups.has(e.anyOfGroup) && <Tag>One of these routes is enough</Tag>}
                    </p>
                    <p>{e.officialText}</p>
                    <SourceTag sourceId={e.sourceId} sources={sources} />
                    <p className="text-ink-soft">
                      <span className="font-medium text-ink">Our check: </span>
                      {e.reason}
                    </p>
                  </div>
                  <div className="sm:pt-0.5">
                    <RuleStamp status={e.display} />
                  </div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Financial assistance" icon={<Wallet className="size-4 text-teal" aria-hidden />}>
            <div className="rounded-xl bg-paper p-4">
              {scheme.benefitAmountInr !== null ? (
                <>
                  <p className="font-display text-2xl font-semibold">Up to {formatInrShort(scheme.benefitAmountInr)}</p>
                  {scheme.benefitUnit && <p className="text-ink-soft">{scheme.benefitUnit}</p>}
                  <p className="mt-2 text-[0.8125rem] text-muted">
                    This is the scheme&apos;s documented ceiling — not the amount any one person will receive. The actual
                    amount depends on the approved treatment and can&apos;t be calculated here.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Benefit amount not published in our verified sources</p>
                  <p className="text-ink-soft">The scheme decides the amount case by case. We don&apos;t estimate it.</p>
                </>
              )}
            </div>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[11rem_1fr]">
              <dt className="font-medium text-muted">How it&apos;s paid</dt>
              <dd>{mechanismLabel[scheme.benefitMechanism]}</dd>
              <dt className="font-medium text-muted">Paid to</dt>
              <dd>{recipientLabel[scheme.paymentRecipient]}</dd>
            </dl>
            <ul className="space-y-2.5">
              {scheme.benefitDetails.map((d) => (
                <li key={d.text} className="space-y-0.5 border-l-2 border-line-strong pl-3">
                  <p>{d.text}</p>
                  <SourceTag sourceId={d.sourceId} sources={sources} />
                </li>
              ))}
            </ul>
            {scheme.patientCostsNote && (
              <p className="rounded-lg border border-warn/25 bg-warn-wash p-3">
                <span className="font-semibold">What may still be yours to pay: </span>
                {scheme.patientCostsNote}
              </p>
            )}
          </Section>

          <Section title="Required documents" icon={<FileCheck2 className="size-4 text-teal" aria-hidden />}>
            {result.documents.filter((d) => !d.isProvisional).length > 0 ? (
              <ul className="space-y-2.5">
                {result.documents
                  .filter((d) => !d.isProvisional)
                  .map((d) => (
                    <li key={d.document} className="space-y-0.5 border-l-2 border-ok/40 pl-3">
                      <p className="font-medium">{d.document}</p>
                      {d.note && <p className="text-ink-soft">{d.note}</p>}
                      <SourceTag sourceId={d.sourceId} sources={sources} />
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="text-ink-soft">No document list was available in the official sources we verified.</p>
            )}
            {result.documents.some((d) => d.isProvisional) && (
              <div className="rounded-xl border border-dashed border-line-strong p-4">
                <p className="font-semibold">Provisional preparation checklist</p>
                <p className="mb-2 text-muted">Not from official documentation — useful to have ready, but confirm the real list.</p>
                <ul className="list-disc space-y-1 pl-5">
                  {result.documents
                    .filter((d) => d.isProvisional)
                    .map((d) => (
                      <li key={d.document}>{d.document}</li>
                    ))}
                </ul>
              </div>
            )}
          </Section>

          <Section title="How to apply" icon={<Landmark className="size-4 text-teal" aria-hidden />}>
            <p>
              <span className="font-semibold">Channel: </span>
              {scheme.applicationChannel}
            </p>
            <ol className="space-y-2.5">
              {scheme.applicationSteps.map((st, i) => (
                <li key={st.text} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-ink/20 text-xs font-semibold">{i + 1}</span>
                  <span className="space-y-0.5">
                    <span className="block">{st.text}</span>
                    <SourceTag sourceId={st.sourceId} sources={sources} />
                  </span>
                </li>
              ))}
            </ol>
            {scheme.helpdesk.length > 0 && (
              <ul className="space-y-2">
                {scheme.helpdesk.map((h) => (
                  <li key={h.text} className="flex gap-2">
                    <Phone className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                    <span className="space-y-0.5">
                      <span className="block">{h.text}</span>
                      <SourceTag sourceId={h.sourceId} sources={sources} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {applyUrl ? (
                <ExternalLink
                  href={applyUrl}
                  className={buttonClass("primary", "md")}
                  onClick={() => void recordSchemeInteraction({ schemeId: scheme.id, searchId, action: "application_link_clicked" })}
                >
                  Apply on official website <ExternalIcon className="size-4" aria-hidden />
                </ExternalLink>
              ) : (
                <p className="inline-flex items-center gap-2 rounded-lg border border-line-strong px-3 py-2 font-medium text-ink-soft">
                  <ShieldAlert className="size-4" aria-hidden /> Official application link not verified
                </p>
              )}
              {infoUrl && infoUrl !== applyUrl && (
                <ExternalLink href={infoUrl} className="font-medium text-teal hover:underline">
                  Official information page
                </ExternalLink>
              )}
            </div>
            {applyUrl && scheme.applicationUrlStatus === "official_domain_unfetched" && (
              <p className="text-[0.8125rem] text-muted">
                This is an official government domain ({new URL(applyUrl).hostname}). Our automated check couldn&apos;t read
                the page on {formatDate(scheme.lastVerifiedOn)}, so confirm details there.
              </p>
            )}
            <p className="text-[0.8125rem] text-muted">
              Opening a link isn&apos;t an application. To keep track,{" "}
              <Link href="/history" className="font-medium text-teal underline">
                record your status in Scheme history
              </Link>
              .
            </p>
          </Section>

          <Section title="Participating hospitals" icon={<Building2 className="size-4 text-teal" aria-hidden />}>
            <HospitalList hospitals={result.hospitals} sources={sources} />
            {directoryUrl && (
              <p>
                <ExternalLink href={directoryUrl} className="font-medium text-teal hover:underline">
                  Search the official hospital directory for this scheme
                </ExternalLink>
              </p>
            )}
          </Section>

          {(scheme.uncertaintyNotes.length > 0 || result.sources.length > 0) && (
            <Section title="Sources and what we couldn't verify" icon={<ShieldAlert className="size-4 text-teal" aria-hidden />} defaultOpen={false}>
              {scheme.uncertaintyNotes.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-ink-soft">
                  {scheme.uncertaintyNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              <ul className="space-y-2">
                {result.sources.map((src) => (
                  <li key={src.id}>
                    <SourceTag sourceId={src.id} sources={sources} />
                    <p className="text-xs text-muted">
                      {src.title}. {src.publishedOn ? `Published ${formatDate(src.publishedOn)}. ` : ""}Checked {formatDate(src.accessedOn)}.
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </article>
  );
}

const statusText = {
  listed_by_hospital: "Scheme listed in the hospital's own publication",
  listed_by_scheme_document: "Named in a government scheme document",
  unverified: "Not verified",
} as const;

function HospitalList({ hospitals, sources }: { hospitals: RankedHospital[]; sources: Map<string, Source> }) {
  const [showAll, setShowAll] = useState(false);
  if (hospitals.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong p-4 text-ink-soft">
        No verified participating hospitals for this search are in our dataset yet. We don&apos;t list hospitals we can&apos;t trace to a source.
      </p>
    );
  }
  const visible = showAll ? hospitals : hospitals.slice(0, 3);
  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {visible.map(({ hospital: h, links, distanceKm, proximity, treatmentConfirmed }) => {
          const link = links[0];
          const website = safeExternalUrl(h.website);
          const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${h.name}, ${h.city}`)}`;
          return (
            <li key={h.id} className="space-y-2 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{h.name}</p>
                <p className="text-xs text-muted">
                  {distanceKm !== null
                    ? `About ${Math.round(distanceKm)} km away (approximate)`
                    : proximity === "same_district"
                      ? "In your chosen district"
                      : proximity === "same_state"
                        ? "In your chosen state"
                        : "Outside your chosen state"}
                </p>
              </div>
              <p className="flex gap-1.5 text-ink-soft">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                {[h.addressLine, h.city, h.district, stateName(h.state), h.pin].filter(Boolean).join(", ")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Tag className="border-ok/30 bg-ok-wash text-ok">{statusText[link.status]}</Tag>
                {treatmentConfirmed ? (
                  <Tag>Relevant services listed</Tag>
                ) : (
                  <Tag className="border-warn/30 bg-warn-wash text-warn">Availability not confirmed</Tag>
                )}
              </div>
              {link.department && (
                <p>
                  <span className="font-medium">Department: </span>
                  {link.department}
                </p>
              )}
              {link.note && <p className="text-ink-soft">{link.note}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {h.phone && <span>{h.phone}</span>}
                {website && (
                  <ExternalLink href={website} className="font-medium text-teal hover:underline">
                    Official website
                  </ExternalLink>
                )}
                <ExternalLink href={mapUrl} className="font-medium text-teal hover:underline">
                  Open in maps
                </ExternalLink>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <SourceTag sourceId={link.sourceId} sources={sources} />
                <span className="text-xs text-muted">Checked {formatDate(h.lastVerifiedOn)}</span>
              </div>
              <p className="text-xs text-muted">
                Current empanelment and bed availability aren&apos;t confirmed by us. Call the hospital&apos;s scheme desk first.
                {distanceKm !== null && h.coordinatesNote ? ` ${h.coordinatesNote}` : ""}
              </p>
            </li>
          );
        })}
      </ul>
      {hospitals.length > 3 && (
        <button type="button" className="text-sm font-medium text-teal underline" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show fewer hospitals" : `Show ${hospitals.length - 3} more`}
        </button>
      )}
    </div>
  );
}
