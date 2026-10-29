"use client";
import { CheckCircle2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { saveProfile } from "@/app/actions/profile";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChoicePills, Field, Input, Select, describedBy } from "@/components/ui/form";
import { Notice, Panel } from "@/components/ui/feedback";
import type { Address, Profile } from "@/lib/data/user-types";
import { INCOME_RANGES, INDIAN_STATES, POLICY_TYPES, SOCIAL_CATEGORIES } from "@/lib/reference/india";
import { profileCompletion } from "@/lib/profile";

interface FormState {
  fullName: string;
  dateOfBirth: string;
  phoneNumber: string;
  religion: string;
  socialCategory: string;
  permanentAddress: Address;
  currentSameAsPermanent: boolean;
  currentAddress: Address;
  incomeConsent: boolean;
  incomeRangeId: string;
  incomeExactInr: string;
  insuranceStatus: string;
  insuranceInsurer: string;
  insurancePolicyType: string;
  pmjayStatus: string;
  stateBeneficiaryDocument: string;
}

const emptyAddress: Address = { line: "", state: "", district: "", pin: "" };

function initial(p: Profile | null, authPhone: string | null): FormState {
  return {
    fullName: p?.fullName ?? "",
    dateOfBirth: p?.dateOfBirth ?? "",
    phoneNumber: p?.phoneNumber ?? authPhone ?? "",
    religion: p?.religion ?? "",
    socialCategory: p?.socialCategory ?? "",
    permanentAddress: p?.permanentAddress ?? emptyAddress,
    currentSameAsPermanent: p?.currentSameAsPermanent ?? true,
    currentAddress: p?.currentAddress ?? emptyAddress,
    incomeConsent: p?.incomeConsent ?? false,
    incomeRangeId: p?.incomeRangeId ?? "",
    incomeExactInr: p?.incomeExactInr != null ? String(p.incomeExactInr) : "",
    insuranceStatus: p?.insuranceStatus ?? "",
    insuranceInsurer: p?.insuranceInsurer ?? "",
    insurancePolicyType: p?.insurancePolicyType ?? "",
    pmjayStatus: p?.pmjayStatus ?? "",
    stateBeneficiaryDocument: p?.stateBeneficiaryDocument ?? "",
  };
}

export function ProfileForm({
  profile,
  authPhone,
  onboarding,
}: {
  profile: Profile | null;
  authPhone: string | null;
  onboarding: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initial(profile, authPhone));
  const [saved, setSaved] = useState<Profile | null>(profile);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setAddr = (which: "permanentAddress" | "currentAddress", key: keyof Address, value: string) =>
    setForm((f) => ({ ...f, [which]: { ...f[which], [key]: value } }));

  const completion = profileCompletion(saved, authPhone);

  function submit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      const res = await saveProfile({
        ...form,
        currentAddress: form.currentSameAsPermanent ? null : form.currentAddress,
      });
      if (res.ok) {
        setErrors({});
        setSaved(res.profile);
        setMessage({ tone: "success", text: "Profile saved." });
        if (onboarding) router.push("/dashboard?welcome=1");
        else router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        setMessage({ tone: "error", text: res.error });
        requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      }
    });
  }

  const err = (k: string) => errors[k];
  const addressFields = (which: "permanentAddress" | "currentAddress", title: string) => (
    <fieldset className="space-y-4">
      <legend className="text-[0.95rem] font-semibold">{title}</legend>
      <Field id={`${which}-line`} label="House, street and area" required error={err(`${which}.line`)}>
        <Input
          id={`${which}-line`}
          autoComplete="street-address"
          value={form[which].line}
          onChange={(e) => setAddr(which, "line", e.target.value)}
          aria-invalid={Boolean(err(`${which}.line`))}
          aria-describedby={describedBy(`${which}-line`, err(`${which}.line`))}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${which}-state`} label="State / UT" required error={err(`${which}.state`)}>
          <Select
            id={`${which}-state`}
            value={form[which].state}
            onChange={(e) => setAddr(which, "state", e.target.value)}
            aria-invalid={Boolean(err(`${which}.state`))}
          >
            <option value="">Choose…</option>
            {INDIAN_STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${which}-district`} label="District" required error={err(`${which}.district`)}>
          <Input
            id={`${which}-district`}
            value={form[which].district}
            onChange={(e) => setAddr(which, "district", e.target.value)}
            aria-invalid={Boolean(err(`${which}.district`))}
          />
        </Field>
        <Field id={`${which}-pin`} label="PIN code" required error={err(`${which}.pin`)}>
          <Input
            id={`${which}-pin`}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            value={form[which].pin}
            onChange={(e) => setAddr(which, "pin", e.target.value.replace(/\D/g, ""))}
            aria-invalid={Boolean(err(`${which}.pin`))}
          />
        </Field>
      </div>
    </fieldset>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="min-w-48 flex-1">
          <p className="text-sm font-semibold">
            Profile essentials: {completion.done} of {completion.total} complete
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="h-full rounded-full bg-ok" style={{ width: `${(completion.done / completion.total) * 100}%` }} />
          </div>
        </div>
        {completion.missing.length > 0 ? (
          <p className="text-sm text-muted">Missing: {completion.missing.join(", ")}</p>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-ok">
            <CheckCircle2 className="size-4" aria-hidden /> Ready to prefill searches
          </p>
        )}
      </div>

      {message && (
        <Notice tone={message.tone} role={message.tone === "error" ? "alert" : "status"} title={message.text}>
          {message.tone === "success" && !onboarding && (
            <ButtonLink href="/dashboard" size="sm" variant="secondary" className="mt-2">
              Go to Find schemes
            </ButtonLink>
          )}
        </Notice>
      )}

      <Panel className="space-y-5">
        <h2 className="text-xl font-semibold">About you</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="fullName" label="Full name" required error={err("fullName")} className="sm:col-span-2">
            <Input
              id="fullName"
              autoComplete="name"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              aria-invalid={Boolean(err("fullName"))}
            />
          </Field>
          <Field
            id="dateOfBirth"
            label="Date of birth"
            required
            hint="We calculate age from this, so it stays correct over time. Many schemes use age limits."
            error={err("dateOfBirth")}
          >
            <Input
              id="dateOfBirth"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              aria-invalid={Boolean(err("dateOfBirth"))}
              aria-describedby={describedBy("dateOfBirth", err("dateOfBirth"), true)}
            />
          </Field>
          <Field
            id="phoneNumber"
            label="Contact number"
            error={err("phoneNumber")}
            hint="Saving a number here doesn't verify it. Verification status is shown below."
          >
            <Input
              id="phoneNumber"
              type="tel"
              autoComplete="tel"
              value={form.phoneNumber}
              onChange={(e) => set("phoneNumber", e.target.value)}
              aria-invalid={Boolean(err("phoneNumber"))}
              aria-describedby={describedBy("phoneNumber", err("phoneNumber"), true)}
            />
          </Field>
        </div>
      </Panel>

      <Panel className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">Address</h2>
          <p className="mt-1 text-sm text-muted">
            Your permanent address is used for state-residence rules. Where you get treatment is asked separately in
            each search.
          </p>
        </div>
        {addressFields("permanentAddress", "Permanent address")}
        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--teal)]"
            checked={form.currentSameAsPermanent}
            onChange={(e) => set("currentSameAsPermanent", e.target.checked)}
          />
          My current address is the same as my permanent address
        </label>
        {!form.currentSameAsPermanent && addressFields("currentAddress", "Current address")}
        {err("currentAddress") && <p className="text-sm font-medium text-bad">{err("currentAddress")}</p>}
      </Panel>

      <Panel className="space-y-5">
        <div className="flex items-start gap-3">
          <Lock className="mt-1 size-5 shrink-0 text-muted" aria-hidden />
          <div>
            <h2 className="text-xl font-semibold">Optional eligibility details</h2>
            <p className="mt-1 max-w-prose text-sm text-muted">
              Skip any of these. Some government schemes use them as eligibility rules; we only use them to check a
              scheme&apos;s documented criteria and never guess them from your name or address.
            </p>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="socialCategory"
            label="Social category"
            hint="Used only for schemes that have a category rule. None of the schemes in our current dataset use one."
          >
            <Select id="socialCategory" value={form.socialCategory} onChange={(e) => set("socialCategory", e.target.value)}>
              <option value="">Not provided</option>
              {SOCIAL_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            id="religion"
            label="Religion"
            hint="No scheme in our current dataset uses religion. You can leave this blank."
          >
            <Input id="religion" value={form.religion} onChange={(e) => set("religion", e.target.value)} />
          </Field>
        </div>
      </Panel>

      <Panel className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold">Answers to reuse in searches</h2>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Optional. In “According to your profile” mode these prefill the search form; you can still change them
            for a single search.
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--teal)]"
            checked={form.incomeConsent}
            onChange={(e) => set("incomeConsent", e.target.checked)}
          />
          <span>
            <span className="font-semibold">Save my household income</span>
            <span className="block text-muted">
              Income is only stored if this is ticked. Untick it to remove saved income.
            </span>
          </span>
        </label>
        {form.incomeConsent && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="incomeRangeId" label="Annual household income">
              <Select id="incomeRangeId" value={form.incomeRangeId} onChange={(e) => set("incomeRangeId", e.target.value)}>
                <option value="">Not provided</option>
                {INCOME_RANGES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id="incomeExactInr"
              label="Exact annual income (₹)"
              hint="Only needed when a scheme's limit falls inside your range."
              error={err("incomeExactInr")}
            >
              <Input
                id="incomeExactInr"
                inputMode="numeric"
                value={form.incomeExactInr}
                onChange={(e) => set("incomeExactInr", e.target.value.replace(/[^\d]/g, ""))}
                aria-invalid={Boolean(err("incomeExactInr"))}
              />
            </Field>
          </div>
        )}

        <ChoicePills
          name="insuranceStatus"
          legend="Existing health insurance"
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "not_sure", label: "Not sure" },
          ]}
          value={form.insuranceStatus || null}
          onChange={(v) => set("insuranceStatus", v)}
        />
        {form.insuranceStatus === "yes" && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="insuranceInsurer" label="Insurer or scheme name">
              <Input id="insuranceInsurer" value={form.insuranceInsurer} onChange={(e) => set("insuranceInsurer", e.target.value)} />
            </Field>
            <Field id="insurancePolicyType" label="Policy type">
              <Select id="insurancePolicyType" value={form.insurancePolicyType} onChange={(e) => set("insurancePolicyType", e.target.value)}>
                <option value="">Not provided</option>
                {POLICY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        <ChoicePills
          name="pmjayStatus"
          legend="Ayushman Bharat (PM-JAY) status"
          hint="If you're not sure, choose “Not sure” — results will say this needs checking."
          options={[
            { value: "has_card", label: "Have an Ayushman card" },
            { value: "listed", label: "Family is listed, no card yet" },
            { value: "not_listed", label: "Not listed" },
            { value: "not_sure", label: "Not sure" },
          ]}
          value={form.pmjayStatus || null}
          onChange={(v) => set("pmjayStatus", v)}
        />

        <ChoicePills
          name="stateBeneficiaryDocument"
          legend="Household holds a state ration card or domicile certificate"
          hint="Some state schemes (for example in Maharashtra) use ration cards or domicile certificates."
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "not_sure", label: "Not sure" },
          ]}
          value={form.stateBeneficiaryDocument || null}
          onChange={(v) => set("stateBeneficiaryDocument", v)}
        />
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : onboarding ? "Save and continue" : "Save profile"}
        </Button>
        {!onboarding && (
          <Button variant="ghost" onClick={() => { setForm(initial(saved, authPhone)); setErrors({}); setMessage(null); }}>
            Discard changes
          </Button>
        )}
      </div>
    </form>
  );
}
