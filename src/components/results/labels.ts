import type { BenefitMechanism, Criterion, PaymentRecipient, SourceType, VerificationStatus } from "@/lib/types";

export const criterionLabel: Record<Criterion, string> = {
  age: "Age",
  income: "Income",
  residence: "State residency",
  social_category: "Social category",
  beneficiary_status: "Beneficiary status",
  treatment: "Treatment covered",
  insurance: "Insurance",
  facility: "Where treatment happens",
  other: "Other condition",
};

export const mechanismLabel: Record<BenefitMechanism, string> = {
  cashless_package: "Cashless — the scheme pays the hospital an approved package rate",
  one_time_grant_to_hospital: "One-time grant, released to the treating hospital",
  partial_assistance: "Partial financial assistance toward the cost",
  reimbursement: "Reimbursement after paying",
  other: "Not specified in verified sources",
  unknown: "Not verified",
};

export const recipientLabel: Record<PaymentRecipient, string> = {
  hospital: "The hospital (not paid to the patient)",
  beneficiary: "The patient or family",
  varies: "Varies by case",
  unknown: "Not verified",
};

export const sourceTypeLabel: Record<SourceType, string> = {
  official_primary: "Official source",
  official_secondary: "Government summary",
  hospital_official: "Hospital publication",
  news_report: "News report",
};

export const verificationLabel: Record<VerificationStatus, string> = {
  verified: "Verified against official sources",
  partially_verified: "Partly verified — some details need official confirmation",
  requires_verification: "Requires official verification",
};
