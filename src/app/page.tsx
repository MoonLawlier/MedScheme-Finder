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
            <p className="text-sm text-muted">Search by condition or treatment to explore potential medical assistance.</p>
          </div>
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
