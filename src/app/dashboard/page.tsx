import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { DataUnavailableError, getReferenceData } from "@/lib/data/reference";
import { getUserStore } from "@/lib/data/user-store";
import type { SearchRecord } from "@/lib/data/user-types";
import { firstName, profileCompletion } from "@/lib/profile";
import { formatDate } from "@/lib/utils/cn";
import { NeedPicker, WhoAreYouSearchingFor } from "@/components/search/need-picker";
import { Notice, Panel } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import type { MedicalNeed } from "@/lib/types";

export const metadata: Metadata = { title: "Find schemes" };

const steps = [
  { title: "Choose who and what", body: "Search for yourself or someone else, and pick the treatment or condition." },
  { title: "Answer a few questions", body: "Only the details a documented scheme rule depends on. “Not sure” is always allowed." },
  { title: "See every criterion explained", body: "Each rule is marked met, not met, missing information, or needing an official check." },
  { title: "Apply through official channels", body: "We link to government sites and hospital scheme desks — never to third parties." },
];

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser("/dashboard");
  const sp = await searchParams;

  let needs: MedicalNeed[] = [];
  let recent: SearchRecord[] = [];
  let error: string | null = null;
  let profile = null;
  try {
    const store = await getUserStore();
    profile = await store.getProfile(user.id);
    if (!profile) redirect("/profile?welcome=1");
    const [data, searches] = await Promise.all([getReferenceData(), store.listSearches(user.id, 3)]);
    needs = data.medicalNeeds;
    recent = searches;
  } catch (e) {
    if (e instanceof DataUnavailableError) error = e.userMessage;
    else throw e; // includes redirect()
  }

  const completion = profileCompletion(profile, user.phone);
  const name = firstName(profile);
  const needName = (id: string) => needs.find((n) => n.id === id)?.name ?? id;

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold sm:text-4xl">{name ? `Welcome, ${name}` : "Welcome"}</h1>
          <p className="max-w-prose text-ink-soft">Find medical assistance: see which schemes may apply, what they pay for, and where to apply.</p>
        </div>
        {completion.missing.length > 0 && (
          <Link href="/profile" className="rounded-xl border border-warn/30 bg-warn-wash px-4 py-2 text-sm">
            <span className="font-semibold">Profile {completion.done}/{completion.total} complete.</span>{" "}
            <span className="text-ink-soft">Add {completion.missing[0].toLowerCase()} to prefill searches.</span>
          </Link>
        )}
      </header>

      {sp.welcome && <Notice tone="success" title="Profile saved. You're ready to search." />}
      {error && (
        <Notice tone="error" role="alert" title={error}>
          Refresh to try again.
        </Notice>
      )}

      <Panel className="space-y-8">
        <WhoAreYouSearchingFor />
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">What medical assistance are you looking for?</h2>
          {needs.length > 0 ? (
            <NeedPicker needs={needs} />
          ) : (
            !error && <p className="text-sm text-muted">No medical needs are configured yet.</p>
          )}
          <p className="text-sm text-muted">
            Need help with more than one treatment? Run a search for each — results are kept separate so criteria stay clear.
          </p>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Panel className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Recent activity</h2>
            <Link href="/history" className="text-sm font-medium text-teal hover:underline">
              Scheme history
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-ink-soft">No searches yet. Pick a medical need above to run your first one.</p>
          ) : (
            <ul className="divide-y divide-line">
              {recent.map((s) => (
                <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 py-3 text-sm">
                  <span>
                    <span className="font-medium">{needName(s.needId)}</span>{" "}
                    <span className="text-muted">— {s.mode === "open" ? "for someone else" : "with my profile"}</span>
                  </span>
                  <span className="text-muted">{formatDate(s.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="space-y-4">
          <h2 className="text-xl font-semibold">How this works</h2>
          <ol className="space-y-4">
            {steps.map((s, i) => (
              <li key={s.title} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-ink/20 font-display text-sm font-semibold">
                  {i + 1}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{s.title}</span>
                  <span className="block text-sm text-ink-soft">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <ButtonLink href="/help" variant="secondary" size="sm">
            Read about our data and privacy
          </ButtonLink>
        </Panel>
      </div>
    </div>
  );
}
