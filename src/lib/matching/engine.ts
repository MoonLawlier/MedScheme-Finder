/**
 * Deterministic, explainable eligibility engine.
 *
 * - Every rule evaluates to MATCH, DOES_NOT_MATCH or UNKNOWN.
 * - UNKNOWN never becomes a match. A scheme is a "potential match" only when
 *   every mandatory criterion is a MATCH, and even then the UI says official
 *   verification is still required.
 * - No probabilities or percentages are produced.
 */
import { compareIncomeToMax } from "@/lib/matching/income";
import { rankHospitals } from "@/lib/matching/hospitals";
import { stateName } from "@/lib/reference/india";
import type {
  EligibilityRule,
  OverallStatus,
  ReferenceData,
  RuleDisplayStatus,
  RuleEvaluation,
  RuleOutcome,
  Scheme,
  SchemeResult,
  SchemeTreatment,
  SearchCriteria,
} from "@/lib/types";

interface Verdict {
  outcome: RuleOutcome;
  display: RuleDisplayStatus;
  reason: string;
}

const meets = (reason: string): Verdict => ({ outcome: "MATCH", display: "meets", reason });
const fails = (reason: string): Verdict => ({ outcome: "DOES_NOT_MATCH", display: "does_not_meet", reason });
const missing = (reason: string): Verdict => ({ outcome: "UNKNOWN", display: "missing_info", reason });
const verify = (reason: string): Verdict => ({ outcome: "UNKNOWN", display: "requires_verification", reason });

export function evaluateRule(rule: EligibilityRule, c: SearchCriteria): Verdict {
  const d = rule.definition;
  switch (d.type) {
    case "age_range": {
      if (c.age === null) return missing("Age was not provided.");
      if (d.min !== undefined && c.age < d.min) return fails(`Age ${c.age} is below the minimum of ${d.min}.`);
      if (d.max !== undefined && c.age > d.max) return fails(`Age ${c.age} is above the maximum of ${d.max}.`);
      const bounds = [d.min !== undefined ? `${d.min} or older` : null, d.max !== undefined ? `${d.max} or younger` : null]
        .filter(Boolean)
        .join(" and ");
      return meets(`Age ${c.age} meets the documented requirement (${bounds}).`);
    }
    case "income_max": {
      const cmp = compareIncomeToMax(c.income, d.maxAnnualIncomeInr);
      if (cmp.outcome === "MATCH") return meets(cmp.reason);
      if (cmp.outcome === "DOES_NOT_MATCH") return fails(cmp.reason);
      return missing(cmp.reason);
    }
    case "residence_state": {
      if (!c.residenceState) return missing("State of residence was not provided.");
      return d.states.includes(c.residenceState)
        ? meets(`Residence in ${stateName(c.residenceState)} matches the scheme's state.`)
        : fails(
            `The scheme is for residents of ${d.states.map(stateName).join(", ")}; the stated residence is ${stateName(c.residenceState)}.`,
          );
    }
    case "social_category": {
      if (!c.socialCategory || c.socialCategory === "prefer_not_to_say")
        return missing("Social category was not provided. It is optional and only used for this criterion.");
      return d.categories.includes(c.socialCategory)
        ? meets("The stated social category is among the documented categories.")
        : fails("The stated social category is not among the documented categories.");
    }
    case "pmjay_beneficiary": {
      if (!c.pmjayStatus || c.pmjayStatus === "not_sure")
        return missing(
          "PM-JAY beneficiary status is not known. It can be checked on the official NHA beneficiary portal or at an empanelled hospital's Ayushman desk.",
        );
      if (d.accepted.includes(c.pmjayStatus)) {
        return meets(
          c.pmjayStatus === "has_card"
            ? "You indicated an Ayushman card is already held. The hospital will confirm this at admission."
            : "You indicated the family is listed as a PM-JAY beneficiary. This is confirmed against the official database at the hospital.",
        );
      }
      return fails(
        "You indicated the family is not listed as a PM-JAY beneficiary. If unsure, check the official beneficiary portal before ruling this out.",
      );
    }
    case "state_beneficiary_document": {
      const s = c.stateBeneficiaryDocument;
      if (!s || s === "not_sure") return missing(`Not known whether the household holds: ${d.description}.`);
      return s === "yes"
        ? meets(`You indicated the household holds: ${d.description}.`)
        : fails(`You indicated the household does not hold: ${d.description}.`);
    }
    case "insurance_not_excluded": {
      if (c.insurance.status === "yes")
        return meets(
          "Existing insurance was reported. The official source says this does not exclude eligibility for this criterion; scheme rules on CGHS/ECHS/CAPF members still apply (see notes).",
        );
      return meets("The official source states existing private insurance or ESI does not exclude eligibility.");
    }
    case "no_restriction":
      return meets(d.note);
    case "requires_official_check":
      return verify("This documented condition can't be checked from the details entered. The scheme or hospital decides it.");
    case "informational":
      return verify("Shown for information. It is decided during the official application.");
  }
}

function evaluateTreatment(t: SchemeTreatment, needName: string): Verdict {
  switch (t.coverageLevel) {
    case "procedure_verified":
      return meets(`${needName}: the procedure appears in an official package list. ${t.coverageNote}`);
    case "category_verified":
      return meets(`${needName}: an official source covers this condition category. ${t.coverageNote}`);
    case "secondary_source":
      return verify(`${needName}: coverage is reported by a secondary source only. ${t.coverageNote}`);
    case "unverified":
      return verify(`${needName}: coverage for this specific treatment is not verified in our dataset. ${t.coverageNote}`);
  }
}

/** Combine mandatory results. Rules in the same any-of group count as one. */
export function combineOutcomes(evals: RuleEvaluation[]): RuleOutcome {
  const mandatory = evals.filter((e) => e.mandatory);
  const groups = new Map<string, RuleOutcome[]>();
  const singles: RuleOutcome[] = [];
  for (const e of mandatory) {
    if (e.anyOfGroup) {
      const g = groups.get(e.anyOfGroup) ?? [];
      g.push(e.outcome);
      groups.set(e.anyOfGroup, g);
    } else singles.push(e.outcome);
  }
  const groupOutcomes: RuleOutcome[] = [...groups.values()].map((g) =>
    g.includes("MATCH") ? "MATCH" : g.every((o) => o === "DOES_NOT_MATCH") ? "DOES_NOT_MATCH" : "UNKNOWN",
  );
  const all = [...singles, ...groupOutcomes];
  if (all.includes("DOES_NOT_MATCH")) return "DOES_NOT_MATCH";
  if (all.every((o) => o === "MATCH")) return "MATCH";
  return "UNKNOWN";
}

export function overallStatus(scheme: Scheme, evals: RuleEvaluation[]): OverallStatus {
  const combined = combineOutcomes(evals);
  if (combined === "DOES_NOT_MATCH") return "does_not_match";
  if (combined === "MATCH" && scheme.verificationStatus !== "requires_verification") return "potential_match";
  return "needs_verification";
}

function summaryFor(status: OverallStatus, evals: RuleEvaluation[]): string {
  const mandatory = evals.filter((e) => e.mandatory);
  if (status === "does_not_match") {
    const failed = mandatory.filter((e) => e.outcome === "DOES_NOT_MATCH" && !e.anyOfGroup);
    const first = failed[0] ?? mandatory.find((e) => e.outcome === "DOES_NOT_MATCH");
    return first ? `Does not meet a known criterion: ${first.reason}` : "Does not meet a known criterion.";
  }
  if (status === "potential_match") {
    return `Meets all ${mandatory.length} known mandatory criteria checked here. The scheme still has to confirm eligibility.`;
  }
  const unknown = mandatory.filter((e) => e.outcome === "UNKNOWN").length;
  const missingCount = mandatory.filter((e) => e.display === "missing_info").length;
  const parts = [];
  if (missingCount) parts.push(`${missingCount} need${missingCount === 1 ? "s" : ""} more information`);
  if (unknown - missingCount > 0) parts.push(`${unknown - missingCount} need${unknown - missingCount === 1 ? "s" : ""} official verification`);
  return parts.length
    ? `No known criterion fails. ${parts.join(", ")}.`
    : "No known criterion fails, but the scheme record itself still needs official verification.";
}

export function evaluateScheme(scheme: Scheme, data: ReferenceData, criteria: SearchCriteria): SchemeResult | null {
  const treatment = data.treatments.find((t) => t.schemeId === scheme.id && t.needId === criteria.needId);
  if (!treatment) return null;
  const need = data.medicalNeeds.find((n) => n.id === criteria.needId);

  const rules = data.rules.filter((r) => r.schemeId === scheme.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const evaluations: RuleEvaluation[] = rules.map((rule) => {
    const v = evaluateRule(rule, criteria);
    return {
      ruleId: rule.id,
      criterion: rule.criterion,
      outcome: v.outcome,
      display: v.display,
      officialText: rule.officialText,
      reason: v.reason,
      mandatory: rule.mandatory,
      anyOfGroup: rule.anyOfGroup,
      sourceId: rule.sourceId,
    };
  });
  const tv = evaluateTreatment(treatment, need?.name ?? criteria.needId);
  evaluations.push({
    ruleId: `treatment:${scheme.id}:${treatment.needId}`,
    criterion: "treatment",
    outcome: tv.outcome,
    display: tv.display,
    officialText: `The scheme must cover ${need?.name.toLowerCase() ?? "the selected need"}.`,
    reason: tv.reason,
    mandatory: true,
    anyOfGroup: null,
    sourceId: treatment.sourceId,
  });

  const overall = overallStatus(scheme, evaluations);
  const sourceIds = new Set([...scheme.sourceIds, ...evaluations.map((e) => e.sourceId).filter(Boolean)] as string[]);
  return {
    scheme,
    treatment,
    overall,
    summaryReason: summaryFor(overall, evaluations),
    evaluations,
    documents: data.documents.filter((d) => d.schemeId === scheme.id).sort((a, b) => a.sortOrder - b.sortOrder),
    hospitals: rankHospitals(
      data.schemeHospitals.filter((l) => l.schemeId === scheme.id),
      data.hospitals,
      criteria.needId,
      criteria.treatmentLocation,
    ),
    sources: data.sources.filter((s) => sourceIds.has(s.id)),
  };
}

export function runMatching(data: ReferenceData, criteria: SearchCriteria, opts: { includeDemo?: boolean } = {}): SchemeResult[] {
  return data.schemes
    .filter((s) => opts.includeDemo || !s.isDemo)
    .map((s) => evaluateScheme(s, data, criteria))
    .filter((r): r is SchemeResult => r !== null)
    .sort(compareByMatchStrength);
}

/* ------------------------------ Sort & filter ----------------------------- */

const statusRank: Record<OverallStatus, number> = { potential_match: 0, needs_verification: 1, does_not_match: 2 };

export function compareByMatchStrength(a: SchemeResult, b: SchemeResult): number {
  const s = statusRank[a.overall] - statusRank[b.overall];
  if (s !== 0) return s;
  const count = (r: SchemeResult, o: RuleOutcome) => r.evaluations.filter((e) => e.mandatory && e.outcome === o).length;
  const m = count(b, "MATCH") - count(a, "MATCH");
  if (m !== 0) return m;
  const u = count(a, "UNKNOWN") - count(b, "UNKNOWN");
  if (u !== 0) return u;
  return a.scheme.officialName.localeCompare(b.scheme.officialName);
}

export type SortKey = "match" | "benefit" | "type" | "hospitals" | "verification";
export type ScopeFilter = "all" | "national" | "state";

const verificationRank = { verified: 0, partially_verified: 1, requires_verification: 2 } as const;

export function sortResults(results: SchemeResult[], key: SortKey): SchemeResult[] {
  const copy = [...results];
  switch (key) {
    case "match":
      return copy.sort(compareByMatchStrength);
    case "benefit":
      // Documented ceilings only; schemes without a documented amount go last.
      return copy.sort((a, b) => {
        const av = a.scheme.benefitAmountInr ?? -1;
        const bv = b.scheme.benefitAmountInr ?? -1;
        return bv - av || compareByMatchStrength(a, b);
      });
    case "type":
      return copy.sort((a, b) =>
        a.scheme.scope === b.scheme.scope ? compareByMatchStrength(a, b) : a.scheme.scope === "national" ? -1 : 1,
      );
    case "hospitals":
      return copy.sort((a, b) => b.hospitals.length - a.hospitals.length || compareByMatchStrength(a, b));
    case "verification":
      return copy.sort(
        (a, b) =>
          verificationRank[a.scheme.verificationStatus] - verificationRank[b.scheme.verificationStatus] ||
          compareByMatchStrength(a, b),
      );
  }
}

/**
 * "State schemes" means schemes whose geographic scope is a state and which
 * apply to the search's relevant state (residence first, then treatment state).
 */
export function filterByScope(results: SchemeResult[], filter: ScopeFilter, relevantState: string | null): SchemeResult[] {
  if (filter === "all") return results;
  if (filter === "national") return results.filter((r) => r.scheme.scope === "national");
  return results.filter(
    (r) => r.scheme.scope === "state" && (relevantState === null || r.scheme.applicableStates.includes(relevantState)),
  );
}

export function relevantStateFor(c: SearchCriteria): string | null {
  return c.residenceState ?? c.treatmentLocation.state ?? null;
}

export function countByStatus(results: SchemeResult[]): Record<OverallStatus, number> {
  return results.reduce(
    (acc, r) => ({ ...acc, [r.overall]: acc[r.overall] + 1 }),
    { potential_match: 0, needs_verification: 0, does_not_match: 0 } as Record<OverallStatus, number>,
  );
}
