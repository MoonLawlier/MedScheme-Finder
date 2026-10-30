import { describe, expect, it } from "vitest";
import { findSupportedNeed } from "@/lib/needs/search";
import { loadSeed } from "./fixtures";

const { data } = loadSeed();

describe("condition search", () => {
  it("finds supported entries without case or surrounding-space sensitivity", () => {
    expect(findSupportedNeed("  KNEE REPLACEMENT ", data.medicalNeeds)?.id).toBe("knee-replacement");
    expect(findSupportedNeed("Angioplasty", data.medicalNeeds)?.id).toBe("angioplasty");
  });

  it("accepts the common US spelling of leukaemia", () => {
    expect(findSupportedNeed("Leukemia", data.medicalNeeds)?.id).toBe("leukemia");
  });

  it("does not imply support for an unknown condition", () => {
    expect(findSupportedNeed("unknown condition", data.medicalNeeds)).toBeUndefined();
  });
});
