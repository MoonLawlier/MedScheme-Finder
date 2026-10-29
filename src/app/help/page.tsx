import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { backendMode } from "@/lib/config";
import { getReferenceData } from "@/lib/data/reference";
import { sourceTypeLabel } from "@/components/results/labels";
import { ExternalLink } from "@/components/ui/button";
import { Notice, Panel } from "@/components/ui/feedback";
import { formatDate, safeExternalUrl } from "@/lib/utils/cn";
import type { Source } from "@/lib/types";

export const metadata: Metadata = { title: "Help and privacy" };

const statuses = [
  ["Meets known criterion", "The details entered satisfy this documented rule."],
  ["Does not meet", "The details entered don't satisfy this documented rule."],
  ["Information missing", "We need an answer you skipped (for example age or exact income)."],
  ["Needs official check", "The rule can't be checked from a form — the scheme or hospital decides it, or the coverage isn't verified."],
] as const;

export default async function HelpPage() {
  let sources: Source[] = [];
  let version = "";
  try {
    const data = await getReferenceData();
    sources = data.sources;
    version = data.version;
  } catch {
    sources = [];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">How {brand.name} works</h1>
        <p className="text-ink-soft">What the results mean, where the data comes from, and how your information is handled.</p>
      </header>

      <Panel className="space-y-4">
        <h2 className="text-xl font-semibold">Reading a result</h2>
        <p className="text-ink-soft">
          Each scheme has documented eligibility rules. We check the details you enter against each rule with fixed logic — no AI
          guesses — and mark every rule with one of four statuses:
        </p>
        <dl className="space-y-3 text-sm">
          {statuses.map(([t, d]) => (
            <div key={t}>
              <dt className="font-semibold">{t}</dt>
              <dd className="text-ink-soft">{d}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-ink-soft">
          A scheme is a <strong>potential match</strong> only when every mandatory rule is met. It <strong>needs verification</strong> when
          nothing fails but something is missing or unverified, and it <strong>does not meet a known criterion</strong> when a rule
          clearly fails. We never show approval odds, and a potential match is not an approval.
        </p>
      </Panel>

      <Panel className="space-y-3">
        <h2 className="text-xl font-semibold">Searching for more than one need</h2>
        <p className="text-sm text-ink-soft">
          A person can need more than one treatment. Run a separate search for each — schemes are mapped to each need separately, so the
          criteria stay clear. New needs can be added to the platform without changing how searches work.
        </p>
      </Panel>

      <Panel className="space-y-3" >
        <h2 id="privacy" className="scroll-mt-6 text-xl font-semibold">Privacy notice</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-ink-soft">
          <li>Your profile and history are visible only to you. Database rules block other accounts from reading or changing them.</li>
          <li>Religion and social category are optional and never needed to create an account. We never infer them.</li>
          <li>Household income is saved to your profile only if you tick the consent box.</li>
          <li>
            Search answers — including medical details and anything entered in Open mode — stay in your browser tab. Your history keeps only
            which need you searched, the mode, the date and result counts.
          </li>
          <li>Open mode never reads from or writes to your profile, and its details are cleared when you leave Open mode or sign out.</li>
          <li>Your location is requested only when you press “Use my current location”, is used to sort hospitals, and isn&apos;t stored.</li>
          <li>No medical reports or identity documents are uploaded. No advertising or tracking scripts are used. Sensitive details are never put in page addresses.</li>
        </ul>
      </Panel>

      <Notice tone="warn" title="Medical and financial disclaimer">
        {brand.name} helps you discover and understand assistance options. It does not decide eligibility, replace official scheme
        verification or hospital authorisation, or give medical advice. Benefit figures are documented ceilings, not promised payments.
      </Notice>

      <Panel className="space-y-4">
        <h2 id="sources" className="scroll-mt-6 text-xl font-semibold">Data sources</h2>
        <p className="text-sm text-ink-soft">
          Every scheme, rule, amount and hospital in our dataset points to one of these sources. Where only a secondary source exists, results
          say so. Reference data version {version || "unavailable"}.
        </p>
        {sources.length === 0 ? (
          <p className="text-sm text-muted">Sources couldn&apos;t be loaded right now.</p>
        ) : (
          <ul className="space-y-3">
            {sources.map((s) => {
              const url = safeExternalUrl(s.url);
              return (
                <li key={s.id} className="text-sm">
                  {url ? (
                    <ExternalLink href={url} className="font-medium text-teal hover:underline">
                      {s.title}
                    </ExternalLink>
                  ) : (
                    <span className="font-medium">{s.title}</span>
                  )}
                  <p className="text-xs text-muted">
                    {sourceTypeLabel[s.sourceType]}, {s.publisher}. {s.publishedOn ? `Published ${formatDate(s.publishedOn)}. ` : ""}Checked{" "}
                    {formatDate(s.accessedOn)}.
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel className="space-y-3">
        <h2 id="setup" className="scroll-mt-6 text-xl font-semibold">Deployment status</h2>
        {backendMode === "supabase" ? (
          <p className="text-sm text-ink-soft">This deployment uses Supabase for sign-in and data storage.</p>
        ) : backendMode === "dev" ? (
          <p className="text-sm text-ink-soft">
            Running in development mode: sign-in is not verified and data is written to a local file. Set the Supabase variables in
            <code className="mx-1 rounded bg-paper px-1">.env.local</code>(see README) to enable real accounts, email codes, Google and phone sign-in.
          </p>
        ) : (
          <p className="text-sm text-ink-soft">Supabase isn&apos;t configured, so sign-in and data are unavailable.</p>
        )}
      </Panel>
    </div>
  );
}
