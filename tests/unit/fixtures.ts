import { readFileSync } from "node:fs";
import path from "node:path";
import { buildReferenceData, seedFileToRows } from "@/lib/data/mappers";
import type { SearchCriteria } from "@/lib/types";

export function loadSeed() {
  const json = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "../../supabase/seed/reference-data.json"), "utf8"));
  return { raw: seedFileToRows(json), data: buildReferenceData(seedFileToRows(json)) };
}

export function criteria(overrides: Partial<SearchCriteria> = {}): SearchCriteria {
  return {
    needId: "angioplasty",
    mode: "open",
    age: null,
    residenceState: null,
    residenceDistrict: null,
    income: { rangeId: null, exactInr: null },
    insurance: { status: null, insurer: null, policyType: null },
    socialCategory: null,
    pmjayStatus: null,
    stateBeneficiaryDocument: null,
    needDetails: {},
    treatmentLocation: { state: "MH", district: null, cityOrPin: null, latitude: null, longitude: null, source: "manual" },
    ...overrides,
  };
}
