import { INCOME_RANGES } from "@/lib/reference/india";
import type { IncomeInput, RuleOutcome } from "@/lib/types";

export interface IncomeComparison {
  outcome: RuleOutcome;
  needsExact: boolean;
  reason: string;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Compare a household income input against a maximum-income threshold.
 * `exclusive` means the documented rule is "less than" the amount rather than
 * "up to" it. An exact figure is always preferred. A range only decides the
 * result when the whole range is on one side of the threshold; otherwise the
 * result is UNKNOWN and the user is asked for the exact figure.
 */
export function compareIncomeToMax(income: IncomeInput, maxInr: number, exclusive = false): IncomeComparison {
  const within = (n: number) => (exclusive ? n < maxInr : n <= maxInr);
  const limit = exclusive ? `"less than ${inr(maxInr)}" limit` : `${inr(maxInr)} limit`;
  if (income.exactInr !== null && Number.isFinite(income.exactInr)) {
    return within(income.exactInr)
      ? { outcome: "MATCH", needsExact: false, reason: `Stated income ${inr(income.exactInr)} is within the ${limit}.` }
      : { outcome: "DOES_NOT_MATCH", needsExact: false, reason: `Stated income ${inr(income.exactInr)} is not within the ${limit}.` };
  }
  const range = INCOME_RANGES.find((r) => r.id === income.rangeId);
  if (!range) {
    return { outcome: "UNKNOWN", needsExact: false, reason: "Household income was not provided." };
  }
  if (range.max !== null && within(range.max)) {
    return { outcome: "MATCH", needsExact: false, reason: `The selected range (${range.label}) is within the ${limit}.` };
  }
  if (!within(range.min)) {
    return { outcome: "DOES_NOT_MATCH", needsExact: false, reason: `The selected range (${range.label}) is above the ${limit}.` };
  }
  return {
    outcome: "UNKNOWN",
    needsExact: true,
    reason: `The selected range (${range.label}) includes incomes on both sides of the ${limit}. Enter the exact annual income to check this.`,
  };
}
