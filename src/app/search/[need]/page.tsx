import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { DataUnavailableError, getReferenceData } from "@/lib/data/reference";
import { getUserStore } from "@/lib/data/user-store";
import { ageFromDob } from "@/lib/utils/cn";
import { fieldsForNeed } from "@/lib/needs/registry";
import { SearchForm, type FormConfig, type ProfilePrefill } from "@/components/search/search-form";
import { Notice } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Search details" };

export default async function SearchPage({ params }: PageProps<"/search/[need]">) {
  const { need: needId } = await params;
  const user = await requireUser(`/search/${needId}`);

  let data;
  try {
    data = await getReferenceData();
  } catch (e) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Notice tone="error" role="alert" title={e instanceof DataUnavailableError ? e.userMessage : "Scheme data is unavailable."}>
          Refresh to try again.
        </Notice>
      </div>
    );
  }
  const need = data.medicalNeeds.find((n) => n.id === needId);
  if (!need) notFound();

  let profile = null;
  try {
    profile = await (await getUserStore()).getProfile(user.id);
  } catch {
    profile = null; // the form still works in either mode without prefill
  }

  // Which optional questions are worth asking depends on the documented rules
  // of the schemes mapped to this need — not on a fixed list.
  const schemeIds = new Set(data.treatments.filter((t) => t.needId === needId).map((t) => t.schemeId));
  const rules = data.rules.filter((r) => schemeIds.has(r.schemeId));
  const config: FormConfig = {
    stateDocumentStates: [
      ...new Set(rules.flatMap((r) => (r.definition.type === "state_beneficiary_document" ? [r.definition.state] : []))),
    ],
    stateDocumentDescriptions: Object.fromEntries(
      rules.flatMap((r) => (r.definition.type === "state_beneficiary_document" ? [[r.definition.state, r.definition.description]] : [])),
    ),
    incomeThresholds: rules.flatMap((r) =>
      r.definition.type === "income_max"
        ? [{ amount: r.definition.maxAnnualIncomeInr, scheme: data.schemes.find((s) => s.id === r.schemeId)?.shortName ?? r.schemeId }]
        : [],
    ),
    asksSocialCategory: rules.some((r) => r.definition.type === "social_category"),
    asksPmjayStatus: rules.some((r) => r.definition.type === "pmjay_beneficiary"),
  };

  const prefill: ProfilePrefill | null = profile
    ? {
        age: ageFromDob(profile.dateOfBirth),
        residenceState: profile.permanentAddress.state,
        residenceDistrict: profile.permanentAddress.district,
        treatmentState: (profile.currentAddress ?? profile.permanentAddress).state,
        treatmentDistrict: (profile.currentAddress ?? profile.permanentAddress).district,
        incomeRangeId: profile.incomeConsent ? profile.incomeRangeId : null,
        incomeExactInr: profile.incomeConsent ? profile.incomeExactInr : null,
        insuranceStatus: profile.insuranceStatus,
        insuranceInsurer: profile.insuranceInsurer,
        insurancePolicyType: profile.insurancePolicyType,
        socialCategory: profile.socialCategory,
        pmjayStatus: profile.pmjayStatus,
        stateBeneficiaryDocument: profile.stateBeneficiaryDocument,
      }
    : null;

  return (
    <SearchForm
      need={need}
      needs={data.medicalNeeds}
      fields={fieldsForNeed(need.id)}
      config={config}
      prefill={prefill}
    />
  );
}
