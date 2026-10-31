import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { authProviders, backendMode } from "@/lib/config";
import { safeNext } from "@/lib/auth/safe-next";
import { getCurrentUser } from "@/lib/auth/session";
import { SignInPanel } from "@/components/auth/sign-in-panel";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCurrentUser()) redirect(next);

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1fr_minmax(0,26rem)] md:py-16">
      <div className="space-y-5">
        <h1 className="text-3xl font-semibold sm:text-4xl">Sign in or create an account</h1>
        <p className="max-w-prose text-ink-soft">
          One account for both your own searches and searches you run for a family member. New here? Signing in
          with a code creates your account, then we&apos;ll ask for a few profile details.
        </p>
        <ul className="space-y-3 text-sm text-ink-soft">
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
            Religion and social category are never needed to create an account.
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
            Your profile and search history are visible only to you.
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
            Medical details from a search are not stored in your history.
          </li>
        </ul>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_0_var(--line)]">
        <SignInPanel
          backend={backendMode}
          allowDemoSignIn={process.env.ALLOW_DEV_FALLBACK === "true"}
          providers={authProviders}
          next={next}
          errorCode={typeof sp.error === "string" ? sp.error : null}
        />
      </div>
    </div>
  );
}
