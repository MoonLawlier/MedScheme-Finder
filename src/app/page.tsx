import Link from "next/link";
import { brand } from "@/config/brand";
import { getCurrentUser } from "@/lib/auth/session";
import { buttonClass } from "@/components/ui/button";

export default async function LandingPage() {
  const user = await getCurrentUser();
  return (
    <>
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="max-w-3xl space-y-6">
            <h1 className="text-4xl font-semibold sm:text-5xl lg:text-[3.4rem]">
              Which government scheme could help pay for treatment — and why?
            </h1>
            <p className="max-w-xl text-lg text-ink-soft">
              {brand.name} checks your details against each scheme&apos;s documented rules, shows every criterion it can and
              can&apos;t confirm, and links only to official application channels.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={user ? "/dashboard" : "/sign-in"} className={buttonClass("primary", "lg")}>
                {user ? "Find medical assistance" : "Get started"}
              </Link>
              <Link href="/help" className={buttonClass("secondary", "lg")}>
                How results are worked out
              </Link>
            </div>
<<<<<<< HEAD
          </div>
=======
            <p className="text-sm text-muted">Search by condition or treatment to explore potential medical assistance.</p>
          </div>

          {sample && (
            <figure className="rounded-2xl border border-line bg-paper p-5 sm:p-6">
              <figcaption className="mb-4 space-y-2">
                <p className="text-sm text-muted">Example output from the matching engine.</p>
                <p className="font-display text-xl font-semibold">{sample.scheme.officialName}</p>
                <OverallStamp status={sample.overall} />
              </figcaption>
              <div className="mb-4">
                <Link href={user ? "/dashboard" : "/sign-in"} className={buttonClass("primary", "sm", "w-full")}>
                  {user ? "Find medical assistance" : "Get started"}
                </Link>
              </div>
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                {sample.evaluations
                  .filter((e) => e.mandatory && e.criterion !== "treatment")
                  .slice(0, 4)
                  .map((e) => (
                    <li key={e.ruleId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm">
                        <span className="block font-semibold">{criterionLabel[e.criterion]}</span>
                        <span className="text-ink-soft">{e.officialText}</span>
                      </span>
                      <RuleStamp status={e.display} />
                    </li>
                  ))}
              </ul>
              <p className="mt-3 text-xs text-muted">{sample.summaryReason}</p>
            </figure>
          )}
>>>>>>> origin/main
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Search for yourself or someone else</h2>
          <p className="text-ink-soft">
            Use your saved profile, or switch to Open mode for a parent or relative without touching your own details.
          </p>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">No guesses dressed as answers</h2>
          <p className="text-ink-soft">
            Missing information stays missing. Coverage we couldn&apos;t verify is marked as needing an official check — never as a
            match.
          </p>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Money, explained plainly</h2>
          <p className="text-ink-soft">
            See the documented ceiling, who gets paid, and what may still be yours to cover — with the source beside each claim.
          </p>
        </div>
      </section>
    </>
  );
}
