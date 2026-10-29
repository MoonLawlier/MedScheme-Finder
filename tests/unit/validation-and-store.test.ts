import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DevUserStore } from "@/lib/data/dev-user-store";
import { profileSchema, searchCriteriaSchema } from "@/lib/validation/schemas";
import { ageFromDob, safeExternalUrl } from "@/lib/utils/cn";

const validProfile = {
  fullName: "Test Person",
  dateOfBirth: "1950-06-15",
  phoneNumber: "",
  religion: "",
  socialCategory: "",
  permanentAddress: { line: "12 Test Road", state: "MH", district: "Pune", pin: "411001" },
  currentSameAsPermanent: true,
  currentAddress: null,
  incomeConsent: false,
  incomeRangeId: "lt_1l",
  incomeExactInr: "90000",
  insuranceStatus: "no",
  insuranceInsurer: "Should be dropped",
  insurancePolicyType: null,
  pmjayStatus: "not_sure",
  stateBeneficiaryDocument: "",
};

describe("profile validation", () => {
  it("does not require religion or social category", () => {
    const r = profileSchema.safeParse(validProfile);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.religion).toBeNull();
      expect(r.data.socialCategory).toBeNull();
    }
  });

  it("drops income unless consent is given", () => {
    const r = profileSchema.parse(validProfile);
    expect(r.incomeRangeId).toBeNull();
    expect(r.incomeExactInr).toBeNull();
    const withConsent = profileSchema.parse({ ...validProfile, incomeConsent: true });
    expect(withConsent.incomeExactInr).toBe(90000);
  });

  it("drops insurer details when not insured", () => {
    expect(profileSchema.parse(validProfile).insuranceInsurer).toBeNull();
  });

  it("rejects a malformed PIN and a future date of birth", () => {
    expect(profileSchema.safeParse({ ...validProfile, permanentAddress: { ...validProfile.permanentAddress, pin: "12" } }).success).toBe(false);
    expect(profileSchema.safeParse({ ...validProfile, dateOfBirth: "2999-01-01" }).success).toBe(false);
  });

  it("requires the current address when it differs", () => {
    expect(profileSchema.safeParse({ ...validProfile, currentSameAsPermanent: false }).success).toBe(false);
  });
});

describe("search validation", () => {
  const base = {
    needId: "leukemia",
    mode: "open",
    age: "45",
    income: { rangeId: "", exactInr: "" },
    insurance: { status: "not_sure" },
    needDetails: { subtype: "cml", classification: "chronic" },
    treatmentLocation: { state: "MH", source: "manual" },
  };

  it("accepts valid need-specific details", () => {
    expect(searchCriteriaSchema.safeParse(base).success).toBe(true);
  });

  it("rejects unknown fields and values for the need", () => {
    expect(searchCriteriaSchema.safeParse({ ...base, needDetails: { subtype: "made_up" } }).success).toBe(false);
    expect(searchCriteriaSchema.safeParse({ ...base, needDetails: { diagnosisNotes: "x" } }).success).toBe(false);
  });

  it("requires a treatment location", () => {
    expect(searchCriteriaSchema.safeParse({ ...base, treatmentLocation: { source: "manual" } }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("computes age from date of birth", () => {
    expect(ageFromDob("1950-06-15", new Date("2026-06-14T12:00:00"))).toBe(75);
    expect(ageFromDob("1950-06-15", new Date("2026-06-15T12:00:00"))).toBe(76);
  });

  it("only allows http(s) external links", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("https://pmnrf.gov.in/")).toBe("https://pmnrf.gov.in/");
  });
});

describe("development store scoping", () => {
  it("never returns another user's data", async () => {
    const store = new DevUserStore(path.join(mkdtempSync(path.join(tmpdir(), "msf-")), "db.json"));
    const s = await store.createSearch("alice", {
      needId: "leukemia",
      mode: "profile",
      treatmentState: "MH",
      resultCounts: { potential_match: 0, needs_verification: 1, does_not_match: 0 },
      referenceVersion: "v",
    });
    await store.recordInteraction("bob", { schemeId: "pmjay-family", searchId: s.id, action: "opened" });
    expect(await store.listSearches("bob")).toHaveLength(0);
    const bobInteractions = await store.listInteractions("bob");
    expect(bobInteractions[0].searchId).toBeNull(); // cannot attach to Alice's search
    expect(await store.getProfile("bob")).toBeNull();
  });
});
