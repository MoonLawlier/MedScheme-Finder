import { describe, expect, it } from "vitest";
import {
  combineOutcomes,
  countByStatus,
  evaluateRule,
  filterByScope,
  runMatching,
  sortResults,
} from "@/lib/matching/engine";
import { compareIncomeToMax } from "@/lib/matching/income";
import { haversineKm, rankHospitals } from "@/lib/matching/hospitals";
import type { EligibilityRule, RuleEvaluation } from "@/lib/types";
import { criteria, loadSeed } from "./fixtures";

const { data } = loadSeed();
const find = (results: ReturnType<typeof runMatching>, id: string) => results.find((r) => r.scheme.id === id);

const rule = (definition: EligibilityRule["definition"], extra: Partial<EligibilityRule> = {}): EligibilityRule => ({
  id: "r",
  schemeId: "s",
  criterion: "other",
  definition,
  mandatory: true,
  anyOfGroup: null,
  officialText: "",
  sourceId: null,
  sortOrder: 0,
  ...extra,
});

describe("rule evaluation", () => {
  it("treats a missing age as UNKNOWN, never as a match", () => {
    const v = evaluateRule(rule({ type: "age_range", min: 70 }), criteria({ age: null }));
    expect(v.outcome).toBe("UNKNOWN");
    expect(v.display).toBe("missing_info");
  });

  it("checks age boundaries inclusively", () => {
    expect(evaluateRule(rule({ type: "age_range", min: 70 }), criteria({ age: 70 })).outcome).toBe("MATCH");
    expect(evaluateRule(rule({ type: "age_range", min: 70 }), criteria({ age: 69 })).outcome).toBe("DOES_NOT_MATCH");
    expect(evaluateRule(rule({ type: "age_range", max: 18 }), criteria({ age: 19 })).outcome).toBe("DOES_NOT_MATCH");
  });

  it("never auto-matches criteria that need official checks", () => {
    const v = evaluateRule(rule({ type: "requires_official_check" }), criteria({ age: 80 }));
    expect(v.outcome).toBe("UNKNOWN");
    expect(v.display).toBe("requires_verification");
  });

  it("treats 'not sure' beneficiary status as missing information", () => {
    const r = rule({ type: "pmjay_beneficiary", accepted: ["has_card", "listed"] });
    expect(evaluateRule(r, criteria({ pmjayStatus: "not_sure" })).outcome).toBe("UNKNOWN");
    expect(evaluateRule(r, criteria({ pmjayStatus: "has_card" })).outcome).toBe("MATCH");
    expect(evaluateRule(r, criteria({ pmjayStatus: "not_listed" })).outcome).toBe("DOES_NOT_MATCH");
  });

  it("compares residence state, not treatment state", () => {
    const r = rule({ type: "residence_state", states: ["MH"] });
    const c = criteria({ residenceState: "KA" });
    c.treatmentLocation.state = "MH";
    expect(evaluateRule(r, c).outcome).toBe("DOES_NOT_MATCH");
  });
});

describe("income comparison", () => {
  it("prefers an exact figure", () => {
    expect(compareIncomeToMax({ rangeId: "gt_10l", exactInr: 120_000 }, 125_000).outcome).toBe("MATCH");
    expect(compareIncomeToMax({ rangeId: null, exactInr: 125_001 }, 125_000).outcome).toBe("DOES_NOT_MATCH");
  });

  it("asks for an exact figure when a range straddles the threshold", () => {
    const r = compareIncomeToMax({ rangeId: "1l_2_5l", exactInr: null }, 125_000);
    expect(r.outcome).toBe("UNKNOWN");
    expect(r.needsExact).toBe(true);
  });

  it("decides from a range that sits wholly on one side", () => {
    expect(compareIncomeToMax({ rangeId: "lt_1l", exactInr: null }, 125_000).outcome).toBe("MATCH");
    expect(compareIncomeToMax({ rangeId: "2_5l_5l", exactInr: null }, 125_000).outcome).toBe("DOES_NOT_MATCH");
  });
});

describe("any-of groups", () => {
  const ev = (outcome: RuleEvaluation["outcome"], group: string | null): RuleEvaluation => ({
    ruleId: Math.random().toString(),
    criterion: "other",
    outcome,
    display: "meets",
    officialText: "",
    reason: "",
    mandatory: true,
    anyOfGroup: group,
    sourceId: null,
  });
  it("matches a group when one member matches", () => {
    expect(combineOutcomes([ev("DOES_NOT_MATCH", "g"), ev("MATCH", "g")])).toBe("MATCH");
  });
  it("fails a group only when every member fails", () => {
    expect(combineOutcomes([ev("DOES_NOT_MATCH", "g"), ev("UNKNOWN", "g")])).toBe("UNKNOWN");
    expect(combineOutcomes([ev("DOES_NOT_MATCH", "g"), ev("DOES_NOT_MATCH", "g")])).toBe("DOES_NOT_MATCH");
  });
});

describe("matching against the seeded dataset", () => {
  it("shows the 70+ route as a potential match for a 72-year-old needing angioplasty", () => {
    const results = runMatching(data, criteria({ needId: "angioplasty", age: 72 }));
    expect(find(results, "pmjay-senior-70")?.overall).toBe("potential_match");
  });

  it("rules out the 70+ route for a 60-year-old", () => {
    const results = runMatching(data, criteria({ needId: "knee-replacement", age: 60 }));
    expect(find(results, "pmjay-senior-70")?.overall).toBe("does_not_match");
  });

  it("does not call knee replacement under PM-JAY a confirmed match while coverage is secondary-sourced", () => {
    const results = runMatching(data, criteria({ needId: "knee-replacement", age: 75 }));
    const senior = find(results, "pmjay-senior-70");
    expect(senior?.overall).toBe("needs_verification");
    expect(senior?.evaluations.find((e) => e.criterion === "treatment")?.display).toBe("requires_verification");
  });

  it("excludes the Maharashtra scheme for residents of other states", () => {
    const results = runMatching(data, criteria({ needId: "leukemia", residenceState: "KA" }));
    expect(find(results, "mh-mjpjay-integrated")?.overall).toBe("does_not_match");
  });

  it("never produces a potential match for HMDG while the record requires verification", () => {
    const results = runMatching(data, criteria({ needId: "angioplasty", income: { rangeId: null, exactInr: 50_000 } }));
    expect(find(results, "hmdg")?.overall).toBe("needs_verification");
    const high = runMatching(data, criteria({ needId: "angioplasty", income: { rangeId: null, exactInr: 900_000 } }));
    expect(find(high, "hmdg")?.overall).toBe("does_not_match");
  });

  it("only returns schemes mapped to the selected need", () => {
    const results = runMatching(data, criteria({ needId: "knee-replacement" }));
    expect(results.map((r) => r.scheme.id).sort()).toEqual(["mh-mjpjay-integrated", "pmjay-family", "pmjay-senior-70"]);
  });

  it("returns nothing for an unknown need", () => {
    expect(runMatching(data, criteria({ needId: "unknown-need" }))).toHaveLength(0);
  });

  it("is deterministic", () => {
    const c = criteria({ needId: "leukemia", age: 40, residenceState: "MH", stateBeneficiaryDocument: "yes" });
    expect(JSON.stringify(runMatching(data, c))).toBe(JSON.stringify(runMatching(data, c)));
  });

  it("never emits percentages or probabilities in explanations", () => {
    const results = runMatching(data, criteria({ needId: "leukemia", age: 40 }));
    const text = results.flatMap((r) => [r.summaryReason, ...r.evaluations.map((e) => e.reason)]).join(" ");
    expect(text).not.toMatch(/\d+\s?%|probab|likely to be approved/i);
  });
});

describe("filters and sorting", () => {
  const results = runMatching(data, criteria({ needId: "leukemia", residenceState: "MH" }));

  it("separates national and state schemes by actual scope", () => {
    expect(filterByScope(results, "national", "MH").every((r) => r.scheme.scope === "national")).toBe(true);
    expect(filterByScope(results, "state", "MH").map((r) => r.scheme.id)).toEqual(["mh-mjpjay-integrated"]);
  });

  it("returns an empty list when no state scheme applies to the relevant state", () => {
    expect(filterByScope(results, "state", "KA")).toHaveLength(0);
  });

  it("sorts by documented benefit with unknown amounts last", () => {
    const sorted = sortResults(results, "benefit");
    expect(sorted.at(-1)?.scheme.benefitAmountInr).toBeNull();
  });

  it("counts statuses", () => {
    const counts = countByStatus(results);
    expect(counts.potential_match + counts.needs_verification + counts.does_not_match).toBe(results.length);
  });
});

describe("hospital ranking", () => {
  it("computes great-circle distance", () => {
    expect(haversineKm(19.0, 72.8, 19.0, 72.8)).toBe(0);
    expect(Math.round(haversineKm(19.0047, 72.8434, 28.5672, 77.21))).toBeGreaterThan(1100);
  });

  it("orders by distance when browser coordinates exist", () => {
    const links = data.schemeHospitals.filter((l) => l.schemeId === "ran-umbrella");
    const ranked = rankHospitals(links, data.hospitals, "angioplasty", {
      state: null, district: null, cityOrPin: null, latitude: 28.6, longitude: 77.2, source: "browser",
    });
    expect(ranked[0].hospital.id).toBe("aiims-delhi");
    expect(ranked[0].distanceKm).not.toBeNull();
  });

  it("falls back to state matching without coordinates and never invents a distance", () => {
    const links = data.schemeHospitals.filter((l) => l.schemeId === "ran-umbrella");
    const ranked = rankHospitals(links, data.hospitals, "angioplasty", {
      state: "OD", district: null, cityOrPin: null, latitude: null, longitude: null, source: "manual",
    });
    expect(ranked[0].hospital.id).toBe("aiims-bbsr");
    expect(ranked.every((h) => h.distanceKm === null)).toBe(true);
  });

  it("does not mark scheme-level links as treatment-confirmed", () => {
    const links = data.schemeHospitals.filter((l) => l.schemeId === "pmjay-family");
    const ranked = rankHospitals(links, data.hospitals, "angioplasty", {
      state: "OD", district: null, cityOrPin: null, latitude: null, longitude: null, source: "manual",
    });
    expect(ranked.find((h) => h.hospital.id === "aiims-bbsr")?.treatmentConfirmed).toBe(false);
    expect(ranked.some((h) => h.hospital.id === "tmh-mumbai")).toBe(false); // linked to leukaemia only
  });
});
