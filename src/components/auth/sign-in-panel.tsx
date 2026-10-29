"use client";
import { Mail, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState, type FormEvent } from "react";
import { devSignIn, type DevSignInState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/feedback";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { BackendMode } from "@/lib/config";

interface Props {
  backend: BackendMode;
  providers: { google: boolean; phone: boolean };
  next: string;
  errorCode: string | null;
}

const ERROR_TEXT: Record<string, string> = {
  link_invalid: "That sign-in link has expired or was already used. Request a new code.",
  provider_error: "The sign-in provider returned an error. Try again or use email.",
  not_configured: "Sign-in isn't configured on this deployment.",
};

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("rate limit") || m.includes("security purposes")) return "Too many attempts. Wait a minute, then try again.";
  if (m.includes("expired") || m.includes("invalid")) return "That code is incorrect or has expired. Check it or request a new one.";
  if (m.includes("sms") || m.includes("phone provider")) return "Phone sign-in isn't set up on this project yet. Use email instead.";
  if (m.includes("provider is not enabled")) return "This sign-in method isn't enabled on this project yet. Use email instead.";
  if (m.includes("fetch")) return "Couldn't reach the sign-in service. Check your connection and try again.";
  return "Sign-in failed. Try again, or use a different method.";
}

export function SignInPanel({ backend, providers, next, errorCode }: Props) {
  if (backend === "dev") return <DevSignIn next={next} />;
  if (backend === "unconfigured")
    return (
      <Notice tone="error" title="Sign-in is unavailable">
        Supabase environment variables are not set for this deployment. See the README for setup.
      </Notice>
    );
  return <SupabaseSignIn providers={providers} next={next} errorCode={errorCode} />;
}

function DevSignIn({ next }: { next: string }) {
  const [state, action, pending] = useActionState<DevSignInState, FormData>(devSignIn, { error: null });
  return (
    <div className="space-y-5">
      <Notice tone="warn" title="Development sign-in — no verification">
        Supabase isn&apos;t configured, so this signs you in with whatever email you type, without checking it.
        Use a made-up address. Email codes, Google and phone sign-in work once Supabase is set up.
      </Notice>
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <Field id="dev-email" label="Email (any test address)" required error={state.error ?? undefined}>
          <Input id="dev-email" name="email" type="email" autoComplete="off" placeholder="tester@example.test" required />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Continue in development mode"}
        </Button>
      </form>
    </div>
  );
}

function SupabaseSignIn({ providers, next, errorCode }: Omit<Props, "backend">) {
  const router = useRouter();
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [step, setStep] = useState<"enter" | "code">("enter");
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(errorCode ? ERROR_TEXT[errorCode] ?? null : null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [phoneNote, setPhoneNote] = useState(false);
  const [googleNote, setGoogleNote] = useState(false);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function send(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = getSupabaseBrowserClient();
    const { error: err } =
      method === "email"
        ? await supabase.auth.signInWithOtp({ email: identifier.trim(), options: { emailRedirectTo: redirectTo(), shouldCreateUser: true } })
        : await supabase.auth.signInWithOtp({ phone: identifier.replace(/\s/g, "") });
    setPending(false);
    if (err) return setError(friendly(err.message));
    setStep("code");
    setInfo(
      method === "email"
        ? `We sent a sign-in email to ${identifier.trim()}. Enter the 6-digit code, or open the link in that email.`
        : `We sent a 6-digit code by SMS to ${identifier}.`,
    );
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = getSupabaseBrowserClient();
    const token = code.replace(/\s/g, "");
    const { error: err } =
      method === "email"
        ? await supabase.auth.verifyOtp({ email: identifier.trim(), token, type: "email" })
        : await supabase.auth.verifyOtp({ phone: identifier.replace(/\s/g, ""), token, type: "sms" });
    setPending(false);
    if (err) return setError(friendly(err.message));
    router.replace(next);
    router.refresh();
  }

  async function google() {
    if (!providers.google) return setGoogleNote(true);
    setError(null);
    const { error: err } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo() },
    });
    if (err) setError(friendly(err.message));
  }

  return (
    <div className="space-y-5">
      {error && <Notice tone="error" role="alert" title={error} />}

      <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 rounded-lg border border-line-strong p-1">
        {(["email", "phone"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={method === m}
            onClick={() => {
              if (m === "phone" && !providers.phone) return setPhoneNote(true);
              setMethod(m);
              setStep("enter");
              setIdentifier("");
              setCode("");
              setInfo(null);
            }}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium ${
              method === m ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {m === "email" ? <Mail className="size-4" aria-hidden /> : <Phone className="size-4" aria-hidden />}
            {m === "email" ? "Email" : "Phone"}
          </button>
        ))}
      </div>
      {phoneNote && (
        <Notice tone="info" title="Phone sign-in isn't enabled yet">
          It needs an SMS provider in Supabase (see README → Phone authentication). Use email for now.
        </Notice>
      )}

      {step === "enter" ? (
        <form onSubmit={send} className="space-y-4">
          <Field
            id="identifier"
            label={method === "email" ? "Email address" : "Mobile number"}
            required
            hint={method === "email" ? "We'll email you a one-time code and a sign-in link. No password needed." : "Include the country code, e.g. +91 98765 43210."}
          >
            <Input
              id="identifier"
              type={method === "email" ? "email" : "tel"}
              autoComplete={method === "email" ? "email" : "tel"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" className="w-full" disabled={pending || !identifier.trim()}>
            {pending ? "Sending…" : "Send code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          {info && <Notice tone="success" role="status">{info}</Notice>}
          <Field id="code" label="6-digit code" required>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,8}"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" className="w-full" disabled={pending || code.replace(/\s/g, "").length < 6}>
            {pending ? "Checking…" : "Verify and sign in"}
          </Button>
          <button type="button" className="text-sm font-medium text-teal underline" onClick={() => setStep("enter")}>
            Use a different {method === "email" ? "email" : "number"}
          </button>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="secondary" className="w-full" onClick={google}>
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
          <path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h6c-.3 1.4-1 2.5-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-7.8z" />
          <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8C3.9 20.5 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.7 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.1H2.1C1.4 8.6 1 10.2 1 12s.4 3.4 1.1 4.9l3.6-2.8z" />
          <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2C17.5 2.1 15 1 12 1 7.7 1 3.9 3.5 2.1 7.1l3.6 2.8C6.6 7.4 9.1 5.4 12 5.4z" />
        </svg>
        Continue with Google
      </Button>
      {googleNote && (
        <Notice tone="info" title="Google sign-in isn't enabled yet">
          It needs a Google OAuth client configured in Supabase (see README → Google OAuth). Use email for now.
        </Notice>
      )}
    </div>
  );
}
