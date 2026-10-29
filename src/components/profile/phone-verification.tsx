"use client";
import { BadgeCheck, CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Notice } from "@/components/ui/feedback";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Phone ownership is tracked separately from the number saved in the profile:
 * it is "verified" only when Supabase Auth confirms an SMS code.
 */
export function PhoneVerification({
  authMode,
  phoneEnabled,
  verifiedPhone,
}: {
  authMode: "supabase" | "dev";
  phoneEnabled: boolean;
  verifiedPhone: string | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"idle" | "enter" | "code">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (verifiedPhone)
    return (
      <p className="inline-flex items-center gap-2 text-sm font-medium text-ok">
        <BadgeCheck className="size-4" aria-hidden /> Phone {verifiedPhone} verified by SMS
      </p>
    );

  if (authMode === "dev" || !phoneEnabled)
    return (
      <p className="inline-flex items-start gap-2 text-sm text-muted">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {authMode === "dev"
          ? "Phone not verified. SMS verification isn't available in development mode."
          : "Phone not verified. SMS verification needs an SMS provider in Supabase (see README)."}
      </p>
    );

  async function send(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: err } = await getSupabaseBrowserClient().auth.updateUser({ phone: phone.replace(/\s/g, "") });
    setPending(false);
    if (err) return setError("Couldn't send a code to that number. Check it, or try again later.");
    setStep("code");
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const { error: err } = await getSupabaseBrowserClient().auth.verifyOtp({
      phone: phone.replace(/\s/g, ""),
      token: code.trim(),
      type: "phone_change",
    });
    setPending(false);
    if (err) return setError("That code is incorrect or has expired.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="inline-flex items-center gap-2 text-sm text-muted">
        <CircleAlert className="size-4" aria-hidden /> Phone not verified.
      </p>
      {error && <Notice tone="error" role="alert" title={error} />}
      {step === "idle" && (
        <Button size="sm" variant="secondary" onClick={() => setStep("enter")}>
          Verify a phone number by SMS
        </Button>
      )}
      {step === "enter" && (
        <form onSubmit={send} className="flex flex-wrap items-end gap-3">
          <Field id="verify-phone" label="Mobile number" required className="min-w-56 flex-1">
            <Input id="verify-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </Field>
          <Button type="submit" size="md" disabled={pending}>
            {pending ? "Sending…" : "Send code"}
          </Button>
        </form>
      )}
      {step === "code" && (
        <form onSubmit={verify} className="flex flex-wrap items-end gap-3">
          <Field id="verify-code" label="6-digit code" required className="min-w-40 flex-1">
            <Input id="verify-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? "Checking…" : "Verify"}
          </Button>
        </form>
      )}
    </div>
  );
}
