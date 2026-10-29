import { describe, expect, it } from "vitest";
import { checkSeedIntegrity } from "@/lib/data/seed-integrity";
import { isGovDomain } from "@/lib/utils/cn";
import { loadSeed } from "./fixtures";

const { raw, data } = loadSeed();

describe("reference dataset integrity", () => {
  it("passes every integrity check", () => {
    expect(checkSeedIntegrity(raw)).toEqual([]);
  });

  it("contains no demo records presented as real schemes", () => {
    for (const s of data.schemes) {
      if (s.isDemo) expect(s.officialName).toContain("DEMO DATA");
    }
  });

  it("only links application buttons to government domains", () => {
    for (const s of data.schemes) {
      if (s.applicationUrl) expect(isGovDomain(s.applicationUrl)).toBe(true);
    }
  });

  it("covers each MVP scenario with at least one sourced scheme", () => {
    for (const need of ["knee-replacement", "leukemia", "angioplasty"]) {
      expect(data.treatments.some((t) => t.needId === need && t.sourceId)).toBe(true);
    }
  });

  it("catches an unsourced claim", () => {
    const broken = structuredClone(raw);
    broken.scheme_eligibility_rules[0].source_id = null;
    expect(checkSeedIntegrity(broken).length).toBeGreaterThan(0);
  });

  it("catches an application URL marked unverified", () => {
    const broken = structuredClone(raw);
    broken.schemes[0].application_url_status = "not_verified";
    expect(checkSeedIntegrity(broken).join()).toMatch(/unverified application URL/);
  });
});
