"use client";
import { ArrowLeft, Crosshair, Lock, RotateCcw, Save, Search, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react";
import { saveSearchAnswersToProfile } from "@/app/actions/profile";
import { runSearch } from "@/app/actions/search";
import { useMode } from "@/components/layout/mode-provider";
import { NeedPicker } from "@/components/search/need-picker";
import { Button, buttonClass } from "@/components/ui/button";
import { ChoicePills, Field, Input, Select } from "@/components/ui/form";
import { Notice, Panel } from "@/components/ui/feedback";
import { clearDraft, loadDraft, saveDraft, saveResults } from "@/lib/client/session-store";
import { isFieldVisible, optionsFor, type NeedField } from "@/lib/needs/registry";
import { INCOME_RANGES, INDIAN_STATES, POLICY_TYPES, SOCIAL_CATEGORIES, stateName } from "@/lib/reference/india";
import { fieldErrors, searchCriteriaSchema } from "@/lib/validation/schemas";
import type { MedicalNeed, SearchMode } from "@/lib/types";
import { cn, formatInr } from "@/lib/utils/cn";

export interface FormConfig {
  stateDocumentStates: string[];
  stateDocumentDescriptions: Record<string, string>;
  incomeThresholds: { amount: number; exclusive: boolean; scheme: string }[];
  asksSocialCategory: boolean;
  asksPmjayStatus: boolean;
}

export interface ProfilePrefill {
  age: number | null;
  residenceState: string | null;
  residenceDistrict: string | null;
  treatmentState: string | null;
  treatmentDistrict: string | null;
  incomeRangeId: string | null;
  incomeExactInr: number | null;
  insuranceStatus: string | null;
  insuranceInsurer: string | null;
  insurancePolicyType: string | null;
  socialCategory: string | null;
  pmjayStatus: string | null;
  stateBeneficiaryDocument: string | null;
}

interface Draft {
  age: string;
  residenceState: string;
  residenceDistrict: string;
  incomeRangeId: string;
  incomeExactInr: string;
  insuranceStatus: string;
  insuranceInsurer: string;
  insurancePolicyType: string;
  socialCategory: string;
  pmjayStatus: string;
  stateBeneficiaryDocument: string;
  needDetails: Record<string, string>;
  treatmentState: string;
  treatmentDistrict: string;
  treatmentCityOrPin: string;
  latitude: number | null;
  longitude: number | null;
}

type PrefillKey = Exclude<keyof Draft, "needDetails" | "latitude" | "longitude" | "treatmentCityOrPin">;

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function draftFromProfile(p: ProfilePrefill | null): Draft {
  return {
    age: s(p?.age),
    residenceState: s(p?.residenceState),
    residenceDistrict: s(p?.residenceDistrict),
    incomeRangeId: s(p?.incomeRangeId),
    incomeExactInr: s(p?.incomeExactInr),
    insuranceStatus: s(p?.insuranceStatus),
    insuranceInsurer: s(p?.insuranceInsurer),
    insurancePolicyType: s(p?.insurancePolicyType),
    socialCategory: s(p?.socialCategory),
    pmjayStatus: s(p?.pmjayStatus),
    stateBeneficiaryDocument: s(p?.stateBeneficiaryDocument),
    needDetails: {},
    treatmentState: s(p?.treatmentState),
    treatmentDistrict: s(p?.treatmentDistrict),
    treatmentCityOrPin: "",
    latitude: null,
    longitude: null,
  };
}

interface Props {
  need: MedicalNeed;
  needs: MedicalNeed[];
  fields: NeedField[];
  config: FormConfig;
  prefill: ProfilePrefill | null;
}

const noopSubscribe = () => () => {};

export function SearchForm(props: Props) {
  const { mode } = useMode();
  // The draft lives in sessionStorage, which the server can't see. Render the
  // form only after hydration so server and client output always agree.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!hydrated) {
    return (
      <div className="mx-auto max-w-5xl space-y-4" aria-busy="true" aria-label="Loading search form">
        <div className="h-8 w-2/3 animate-pulse rounded-lg bg-line" />
        <div className="h-64 animate-pulse rounded-2xl bg-line/70" />
      </div>
    );
  }
  // Remount per mode so profile data can never leak into an Open-mode form.
  return <SearchFormInner key={`${mode}:${props.need.id}`} mode={mode} {...props} />;
}

function SearchFormInner({ need, needs, fields, config, prefill, mode }: Props & { mode: SearchMode }) {
  const router = useRouter();
  const isOpen = mode === "open";
  const baseline = useMemo(() => (isOpen ? draftFromProfile(null) : draftFromProfile(prefill)), [isOpen, prefill]);
  const [draft, setDraft] = useState<Draft>(() => loadDraft<Draft>(mode, need.id) ?? baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [geo, setGeo] = useState<"idle" | "requesting" | "granted" | "denied" | "unavailable">(
    draft.latitude !== null ? "granted" : "idle",
  );
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => saveDraft(mode, need.id, draft), [draft, mode, need.id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setDetail = (key: string, value: string) =>
    setDraft((d) => {
      const next = { ...d.needDetails, [key]: value };
      // Drop dependent answers whose options no longer apply (e.g. phase after a type change).
      for (const f of fields) {
        if (!isFieldVisible(f, next)) delete next[f.key];
        else if (next[f.key] && !optionsFor(f, next).some((o) => o.value === next[f.key])) delete next[f.key];
      }
      return { ...d, needDetails: next };
    });

  const who = isOpen
    ? { age: "Age of the person needing treatment", residence: "Their state of residence", income: "Their household's annual income" }
    : { age: "Your age", residence: "Your state of residence", income: "Your household's annual income" };

  const origin = (key: PrefillKey): ReactNode => {
    if (isOpen || !prefill) return null;
    const fromProfile = baseline[key];
    if (!fromProfile) return null;
    return draft[key] === fromProfile ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-wash px-2 py-0.5 text-xs font-medium text-teal-strong">
        <UserRound className="size-3" aria-hidden /> From your profile
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-warn-wash px-2 py-0.5 text-xs font-medium text-warn">
        Changed for this search only
      </span>
    );
  };

  const range = INCOME_RANGES.find((r) => r.id === draft.incomeRangeId);
  const straddled = range
    ? config.incomeThresholds.filter(
        // Same boundary logic as the engine: ask only when the range straddles the limit.
        (t) => range.min <= t.amount && (range.max === null || (t.exclusive ? range.max >= t.amount : range.max > t.amount)),
      )
    : [];
  const askStateDoc = config.stateDocumentStates.includes(draft.residenceState);
  const status = draft.needDetails.status;

  function requestLocation() {
    if (!("geolocation" in navigator)) return setGeo("unavailable");
    setGeo("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft((d) => ({
          ...d,
          latitude: Math.round(pos.coords.latitude * 1000) / 1000, // ~100 m precision is plenty
          longitude: Math.round(pos.coords.longitude * 1000) / 1000,
        }));
        setGeo("granted");
      },
      (err) => setGeo(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  }

  function buildCriteria() {
    const visibleDetails = Object.fromEntries(
      Object.entries(draft.needDetails).filter(([k, v]) => {
        const f = fields.find((x) => x.key === k);
        return f && v && isFieldVisible(f, draft.needDetails);
      }),
    );
    return {
      needId: need.id,
      mode,
      age: draft.age,
      residenceState: draft.residenceState,
      residenceDistrict: draft.residenceDistrict,
      income: { rangeId: draft.incomeRangeId, exactInr: draft.incomeExactInr },
      insurance: {
        status: draft.insuranceStatus,
        insurer: draft.insuranceStatus === "yes" ? draft.insuranceInsurer : null,
        policyType: draft.insuranceStatus === "yes" ? draft.insurancePolicyType : null,
      },
      socialCategory: config.asksSocialCategory ? draft.socialCategory : null,
      pmjayStatus: config.asksPmjayStatus ? draft.pmjayStatus : null,
      stateBeneficiaryDocument: askStateDoc ? draft.stateBeneficiaryDocument : null,
      needDetails: visibleDetails,
      treatmentLocation: {
        state: draft.treatmentState,
        district: draft.treatmentDistrict,
        cityOrPin: draft.treatmentCityOrPin,
        latitude: draft.latitude,
        longitude: draft.longitude,
        source: draft.latitude !== null ? ("browser" as const) : ("manual" as const),
      },
    };
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input = buildCriteria();
    const local = searchCriteriaSchema.safeParse(input);
    if (!local.success) {
      setErrors(fieldErrors(local.error));
      setFormError("Some details need fixing.");
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setErrors({});
    start(async () => {
      try {
        const res = await runSearch(input);
        if (!res.ok) {
          if (res.authRequired) return router.push(`/sign-in?next=/search/${need.id}`);
          setErrors(res.fieldErrors ?? {});
          setFormError(res.error);
          return;
        }
        saveResults({
          searchId: res.searchId,
          needId: need.id,
          needName: res.needName,
          mode,
          criteria: res.criteria,
          results: res.results,
          referenceVersion: res.referenceVersion,
          createdAt: new Date().toISOString(),
          historyWarning: res.historyWarning,
          officialResources: res.officialResources,
        });
        router.push("/results");
      } catch {
        setFormError("The search couldn't reach the server. Check your connection and try again.");
      }
    });
  }

  function reset() {
    clearDraft(mode, need.id);
    setDraft(baseline);
    setErrors({});
    setFormError(null);
    setGeo("idle");
  }

  function saveToProfile() {
    setSaveMsg(null);
    startSave(async () => {
      const res = await saveSearchAnswersToProfile({
        incomeRangeId: draft.incomeRangeId || null,
        incomeExactInr: draft.incomeExactInr || null,
        insuranceStatus: draft.insuranceStatus || null,
        insuranceInsurer: draft.insuranceInsurer || null,
        insurancePolicyType: draft.insurancePolicyType || null,
        pmjayStatus: draft.pmjayStatus || null,
        stateBeneficiaryDocument: draft.stateBeneficiaryDocument || null,
      });
      setSaveMsg(
        res.ok
          ? { tone: "success", text: "Saved income, insurance and scheme-status answers to your profile." }
          : { tone: "error", text: res.error },
      );
      if (res.ok) router.refresh();
    });
  }

  const err = (k: string) => errors[k];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Back to Find schemes
        </Link>
        <p
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
            isOpen ? "bg-info-wash text-info" : "bg-teal-wash text-teal-strong",
          )}
          aria-live="polite"
        >
          {isOpen ? <Users className="size-4" aria-hidden /> : <UserRound className="size-4" aria-hidden />}
          {isOpen ? "Open mode: searching for someone else" : "Using your profile"}
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <form onSubmit={submit} noValidate className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-3xl font-semibold">{need.name}: search details</h1>
            <p className="max-w-prose text-ink-soft">
              Answer what you know. Every question allows “Not sure”, and missing answers are shown as missing — never
              assumed.
            </p>
          </header>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Medical need</p>
            <NeedPicker needs={needs} compact activeId={need.id} />
          </div>

          {!isOpen && !prefill && (
            <Notice tone="warn" title="Your profile isn't set up yet">
              Nothing can be prefilled. <Link href="/profile">Complete your profile</Link> or fill in the details below.
            </Notice>
          )}
          {formError && <Notice tone="error" role="alert" title={formError} />}

          <Panel className="space-y-5">
            <h2 className="text-xl font-semibold">{isOpen ? "About the person" : "About you"}</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="age" label={who.age} error={err("age")} badge={origin("age")} hint="Many schemes have age-based routes, such as cover for people aged 70+.">
                <Input id="age" inputMode="numeric" value={draft.age} onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 3))} aria-invalid={Boolean(err("age"))} />
              </Field>
              <div className="hidden sm:block" />
              <Field id="residenceState" label={who.residence} error={err("residenceState")} badge={origin("residenceState")} hint="Used for state-residence rules. This can differ from where treatment happens.">
                <Select id="residenceState" value={draft.residenceState} onChange={(e) => set("residenceState", e.target.value)}>
                  <option value="">Not provided</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="residenceDistrict" label="District of residence" badge={origin("residenceDistrict")}>
                <Input id="residenceDistrict" value={draft.residenceDistrict} onChange={(e) => set("residenceDistrict", e.target.value)} />
              </Field>
            </div>

            {askStateDoc && (
              <ChoicePills
                name="stateBeneficiaryDocument"
                legend={`Does the household hold ${config.stateDocumentDescriptions[draft.residenceState] ?? "a state ration card or domicile certificate"}?`}
                hint={`Asked because a ${stateName(draft.residenceState)} scheme uses it.`}
                badge={origin("stateBeneficiaryDocument")}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                  { value: "not_sure", label: "Not sure" },
                ]}
                value={draft.stateBeneficiaryDocument || null}
                onChange={(v) => set("stateBeneficiaryDocument", v)}
              />
            )}

            {config.asksPmjayStatus && (
              <ChoicePills
                name="pmjayStatus"
                legend="Ayushman Bharat (PM-JAY) status"
                hint="PM-JAY eligibility comes from an official beneficiary list. Choose “Not sure” if you haven't checked."
                badge={origin("pmjayStatus")}
                options={[
                  { value: "has_card", label: "Has an Ayushman card" },
                  { value: "listed", label: "Family is listed" },
                  { value: "not_listed", label: "Not listed" },
                  { value: "not_sure", label: "Not sure" },
                ]}
                value={draft.pmjayStatus || null}
                onChange={(v) => set("pmjayStatus", v)}
              />
            )}

            {config.asksSocialCategory && (
              <Field id="socialCategory" label="Social category" hint="Asked because a scheme for this need has a category rule." badge={origin("socialCategory")}>
                <Select id="socialCategory" value={draft.socialCategory} onChange={(e) => set("socialCategory", e.target.value)}>
                  <option value="">Not provided</option>
                  {SOCIAL_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </Panel>

          <Panel className="space-y-5">
            <h2 className="text-xl font-semibold">Income and insurance</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="incomeRangeId" label={who.income} badge={origin("incomeRangeId")} hint="Include all earning members.">
                <Select id="incomeRangeId" value={draft.incomeRangeId} onChange={(e) => set("incomeRangeId", e.target.value)}>
                  <option value="">Not provided</option>
                  {INCOME_RANGES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="incomeExactInr" label="Exact annual income (₹)" error={err("income.exactInr")} badge={origin("incomeExactInr")} hint="Only needed when a scheme's limit falls inside the range.">
                <Input id="incomeExactInr" inputMode="numeric" value={draft.incomeExactInr} onChange={(e) => set("incomeExactInr", e.target.value.replace(/\D/g, ""))} aria-invalid={Boolean(err("income.exactInr"))} />
              </Field>
            </div>
            {straddled.length > 0 && !draft.incomeExactInr && (
              <Notice tone="info" title="An exact figure would help">
                {straddled.map((t) => `${t.scheme} has a ${formatInr(t.amount)} limit`).join("; ")}, which falls inside the selected range. Enter
                the exact income to check it, or leave it and the result will show “Information missing”.
              </Notice>
            )}

            <ChoicePills
              name="insuranceStatus"
              legend="Existing health insurance"
              badge={origin("insuranceStatus")}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
                { value: "not_sure", label: "Not sure" },
              ]}
              value={draft.insuranceStatus || null}
              onChange={(v) => set("insuranceStatus", v)}
            />
            {draft.insuranceStatus === "yes" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="insuranceInsurer" label="Insurer or scheme name" badge={origin("insuranceInsurer")}>
                  <Input id="insuranceInsurer" value={draft.insuranceInsurer} onChange={(e) => set("insuranceInsurer", e.target.value)} />
                </Field>
                <Field id="insurancePolicyType" label="Policy type" badge={origin("insurancePolicyType")} hint="Some schemes have rules for people already in CGHS, ECHS or ESI.">
                  <Select id="insurancePolicyType" value={draft.insurancePolicyType} onChange={(e) => set("insurancePolicyType", e.target.value)}>
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
          </Panel>

          {fields.length > 0 && (
            <Panel className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold">About the {need.kind === "disease" ? "condition" : "procedure"}</h2>
                <p className="mt-1 text-sm text-muted">
                  We don&apos;t judge whether treatment is needed — that&apos;s the doctor&apos;s decision. These answers only
                  help flag scheme rules.
                </p>
              </div>
              {fields.map((f) =>
                isFieldVisible(f, draft.needDetails) ? (
                  <ChoicePills
                    key={f.key}
                    name={`detail-${f.key}`}
                    legend={f.label}
                    hint={f.help}
                    error={err(`needDetails.${f.key}`)}
                    options={optionsFor(f, draft.needDetails)}
                    value={draft.needDetails[f.key] ?? null}
                    onChange={(v) => setDetail(f.key, v)}
                  />
                ) : null,
              )}
              {status === "completed" && (
                <Notice tone="info" title="Treatment already completed">
                  Schemes handle completed treatment differently — cashless schemes usually work only before or during a
                  hospital stay. Confirm with the scheme before expecting any reimbursement. (Platform guidance.)
                </Notice>
              )}
            </Panel>
          )}

          <Panel className="space-y-5">
            <div>
              <h2 className="text-xl font-semibold">Where treatment is needed</h2>
              <p className="mt-1 text-sm text-muted">
                Used only to sort participating hospitals. It doesn&apos;t affect eligibility.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <Field id="treatmentState" label="State" required={draft.latitude === null} error={err("treatmentLocation.state")} badge={origin("treatmentState")}>
                <Select id="treatmentState" value={draft.treatmentState} onChange={(e) => set("treatmentState", e.target.value)} aria-invalid={Boolean(err("treatmentLocation.state"))}>
                  <option value="">Choose…</option>
                  {INDIAN_STATES.map((st) => (
                    <option key={st.code} value={st.code}>
                      {st.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="treatmentDistrict" label="District" badge={origin("treatmentDistrict")}>
                <Input id="treatmentDistrict" value={draft.treatmentDistrict} onChange={(e) => set("treatmentDistrict", e.target.value)} />
              </Field>
              <Field id="treatmentCityOrPin" label="City or PIN">
                <Input id="treatmentCityOrPin" value={draft.treatmentCityOrPin} onChange={(e) => set("treatmentCityOrPin", e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {geo !== "granted" ? (
                <Button variant="secondary" size="sm" onClick={requestLocation} disabled={geo === "requesting" || geo === "denied"}>
                  <Crosshair className="size-4" aria-hidden />
                  {geo === "requesting" ? "Getting location…" : "Use my current location"}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraft((d) => ({ ...d, latitude: null, longitude: null }));
                    setGeo("idle");
                  }}
                >
                  Stop using my location
                </Button>
              )}
              <p className="text-sm text-muted" aria-live="polite">
                {geo === "idle" && "Your browser will ask for permission. The location isn't saved."}
                {geo === "granted" && "Using your approximate current location to sort hospitals by distance."}
                {geo === "denied" && "Location permission was declined. Use the state and district above instead."}
                {geo === "unavailable" && "Your location isn't available on this device. Use the state and district above."}
              </p>
            </div>
          </Panel>

          <Notice tone="neutral" title="What happens to these details">
            They&apos;re used to check scheme rules for this search and kept only in this browser tab. Your history records
            which medical need you searched and when — not your answers.
            {isOpen && " In Open mode, nothing is copied to your profile and the details are cleared when you leave Open mode."}
          </Notice>

          {saveMsg && <Notice tone={saveMsg.tone} role={saveMsg.tone === "error" ? "alert" : "status"} title={saveMsg.text} />}

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <Button type="submit" size="lg" disabled={pending}>
              <Search className="size-4" aria-hidden />
              {pending ? "Finding schemes…" : "Find schemes"}
            </Button>
            <Button variant="secondary" onClick={reset}>
              <RotateCcw className="size-4" aria-hidden /> Reset
            </Button>
            {!isOpen && prefill && (
              <Button variant="ghost" onClick={saveToProfile} disabled={saving}>
                <Save className="size-4" aria-hidden />
                {saving ? "Saving…" : "Save income & insurance answers to my profile"}
              </Button>
            )}
            <Link href="/dashboard" className={buttonClass("ghost")}>
              Back
            </Link>
          </div>
        </form>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Panel className="space-y-3 text-sm">
            <h2 className="flex items-center gap-2 font-sans text-base font-semibold">
              <Lock className="size-4 text-muted" aria-hidden /> Privacy
            </h2>
            <p className="text-ink-soft">No medical records or diagnosis reports are requested. Answers stay in this tab and aren&apos;t sent anywhere except our server for this check.</p>
            <p className="text-ink-soft">
              {isOpen
                ? "You're in Open mode: your own profile isn't used or changed."
                : "Changes you make here don't update your profile unless you press “Save … to my profile”."}
            </p>
          </Panel>
          <Panel className="space-y-2 text-sm">
            <h2 className="font-sans text-base font-semibold">How results are worded</h2>
            <p className="text-ink-soft">
              “Potential match” means every known rule is met — the scheme still decides. We never show approval chances
              or promise payments.
            </p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
