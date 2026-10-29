/** States and Union Territories of India, keyed by a stable 2-letter code. */
export const INDIAN_STATES: { code: string; name: string }[] = [
  { code: "AN", name: "Andaman and Nicobar Islands" },
  { code: "AP", name: "Andhra Pradesh" },
  { code: "AR", name: "Arunachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "BR", name: "Bihar" },
  { code: "CH", name: "Chandigarh" },
  { code: "CT", name: "Chhattisgarh" },
  { code: "DH", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "DL", name: "Delhi" },
  { code: "GA", name: "Goa" },
  { code: "GJ", name: "Gujarat" },
  { code: "HR", name: "Haryana" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "JK", name: "Jammu and Kashmir" },
  { code: "JH", name: "Jharkhand" },
  { code: "KA", name: "Karnataka" },
  { code: "KL", name: "Kerala" },
  { code: "LA", name: "Ladakh" },
  { code: "LD", name: "Lakshadweep" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "MH", name: "Maharashtra" },
  { code: "MN", name: "Manipur" },
  { code: "ML", name: "Meghalaya" },
  { code: "MZ", name: "Mizoram" },
  { code: "NL", name: "Nagaland" },
  { code: "OD", name: "Odisha" },
  { code: "PY", name: "Puducherry" },
  { code: "PB", name: "Punjab" },
  { code: "RJ", name: "Rajasthan" },
  { code: "SK", name: "Sikkim" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TG", name: "Telangana" },
  { code: "TR", name: "Tripura" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "UK", name: "Uttarakhand" },
  { code: "WB", name: "West Bengal" },
];

export const STATE_CODES = INDIAN_STATES.map((s) => s.code);

export function stateName(code: string | null | undefined): string {
  if (!code) return "Not provided";
  return INDIAN_STATES.find((s) => s.code === code)?.name ?? code;
}

/**
 * Household income ranges (annual, INR). These are display buckets only —
 * schemes use different thresholds, so the engine compares a rule's threshold
 * against the range bounds and asks for an exact figure when a range straddles
 * a threshold. Edit freely; nothing else depends on specific bucket edges.
 */
export const INCOME_RANGES: { id: string; label: string; min: number; max: number | null }[] = [
  { id: "lt_1l", label: "Below ₹1,00,000", min: 0, max: 99_999 },
  { id: "1l_2_5l", label: "₹1,00,000 – ₹2,50,000", min: 100_000, max: 250_000 },
  { id: "2_5l_5l", label: "₹2,50,001 – ₹5,00,000", min: 250_001, max: 500_000 },
  { id: "5l_10l", label: "₹5,00,001 – ₹10,00,000", min: 500_001, max: 1_000_000 },
  { id: "gt_10l", label: "Above ₹10,00,000", min: 1_000_001, max: null },
];

export const SOCIAL_CATEGORIES: { id: string; label: string }[] = [
  { id: "general", label: "General" },
  { id: "ews", label: "Economically Weaker Section (EWS)" },
  { id: "obc", label: "Other Backward Class (OBC)" },
  { id: "sc", label: "Scheduled Caste (SC)" },
  { id: "st", label: "Scheduled Tribe (ST)" },
  { id: "other", label: "Other / state-specific category" },
  { id: "prefer_not_to_say", label: "Prefer not to say" },
];

export const POLICY_TYPES = [
  "Individual",
  "Family floater",
  "Employer / group",
  "Government scheme (e.g. CGHS, ECHS, ESI)",
  "Other",
];
