/**
 * Domain types shared by the data layer, the matching engine and the UI.
 * Reference data (schemes, hospitals, sources) is public; profile and search
 * data is private to the signed-in user.
 */

export type NeedKind = "procedure" | "disease" | "both";

export interface MedicalNeed {
  id: string; // stable slug, e.g. "knee-replacement"
  name: string;
  kind: NeedKind;
  specialty: string;
  summary: string;
  sortOrder: number;
}

export type SourceType =
  | "official_primary" // ministry / scheme authority / parliament answer
  | "official_secondary" // another government body restating the scheme
  | "hospital_official" // the hospital's own official publication
  | "news_report"; // reputable media reporting an official statement

export interface Source {
  id: string;
  title: string;
  publisher: string;
  url: string;
  sourceType: SourceType;
  publishedOn: string | null; // ISO date
  accessedOn: string; // ISO date the platform last checked it
  notes: string | null;
}

export type SchemeScope = "national" | "state";

export type BenefitMechanism =
  | "cashless_package" // scheme pays the hospital a package rate
  | "one_time_grant_to_hospital"
  | "partial_assistance"
  | "reimbursement"
  | "other"
  | "unknown";

export type PaymentRecipient = "hospital" | "beneficiary" | "varies" | "unknown";

export type VerificationStatus = "verified" | "partially_verified" | "requires_verification";

export type LinkStatus =
  | "official_verified" // page content fetched and confirmed
  | "official_domain_unfetched" // government domain, content could not be fetched by our checker
  | "not_verified";

export interface SourcedText {
  text: string;
  sourceId: string | null;
}

export interface Scheme {
  id: string;
  officialName: string;
  shortName: string;
  issuingAuthority: string;
  scope: SchemeScope;
  applicableStates: string[]; // state codes; empty for national
  summary: string;
  intendedBeneficiaries: string;
  benefitAmountInr: number | null; // documented ceiling, NOT what a person will receive
  benefitUnit: string | null; // e.g. "per family per year"
  benefitMechanism: BenefitMechanism;
  paymentRecipient: PaymentRecipient;
  benefitDetails: SourcedText[];
  patientCostsNote: string | null;
  applicationChannel: string;
  applicationSteps: SourcedText[];
  applicationUrl: string | null;
  applicationUrlStatus: LinkStatus;
  infoUrl: string | null;
  hospitalDirectoryUrl: string | null;
  helpdesk: SourcedText[];
  verificationStatus: VerificationStatus;
  lastVerifiedOn: string;
  sourceUpdatedOn: string | null;
  uncertaintyNotes: string[];
  isDemo: boolean;
  sourceIds: string[];
}

export type CoverageLevel =
  | "procedure_verified" // the specific procedure appears in an official package list
  | "category_verified" // an official source covers the condition category (e.g. "cancer")
  | "secondary_source" // only reported by a secondary source
  | "unverified";

export interface SchemeTreatment {
  schemeId: string;
  needId: string;
  coverageLevel: CoverageLevel;
  coverageNote: string;
  sourceId: string | null;
}

export type Criterion =
  | "age"
  | "income"
  | "residence"
  | "social_category"
  | "beneficiary_status"
  | "treatment"
  | "insurance"
  | "facility"
  | "other";

/** Structured rule definitions. Each maps to a deterministic evaluator. */
export type RuleDefinition =
  | { type: "age_range"; min?: number; max?: number }
  | { type: "income_max"; maxAnnualIncomeInr: number; exclusive?: boolean } // exclusive: "less than" rather than "up to"
  | { type: "residence_state"; states: string[] }
  | { type: "social_category"; categories: SocialCategory[] }
  | { type: "pmjay_beneficiary"; accepted: PmjayStatus[] }
  | { type: "state_beneficiary_document"; state: string; description: string }
  | { type: "insurance_not_excluded" }
  | { type: "no_restriction"; note: string } // documented absence of a restriction, e.g. "irrespective of income"
  | { type: "requires_official_check" } // documented but not machine-checkable
  | { type: "informational" }; // documented condition shown but not evaluated

export interface EligibilityRule {
  id: string;
  schemeId: string;
  criterion: Criterion;
  definition: RuleDefinition;
  mandatory: boolean;
  anyOfGroup: string | null; // rules sharing a group: at least one must match
  officialText: string; // plain-language summary of the documented condition
  sourceId: string | null;
  sortOrder: number;
}

export interface SchemeDocument {
  schemeId: string;
  document: string;
  note: string | null;
  sourceId: string | null;
  isProvisional: boolean;
  sortOrder: number;
}

export type HospitalVerification =
  | "hospital_official_source"
  | "government_listing"
  | "unverified";

export interface Hospital {
  id: string;
  name: string;
  addressLine: string | null;
  city: string;
  district: string | null;
  state: string; // state code
  pin: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinatesNote: string | null;
  phone: string | null;
  website: string | null;
  verificationStatus: HospitalVerification;
  lastVerifiedOn: string;
  sourceId: string | null;
}

export type SchemeHospitalStatus =
  | "listed_by_hospital"
  | "listed_by_scheme_document"
  | "unverified";

export interface SchemeHospital {
  schemeId: string;
  hospitalId: string;
  needId: string | null; // null = scheme participation without treatment-specific confirmation
  department: string | null;
  status: SchemeHospitalStatus;
  sourceId: string | null;
  note: string | null;
}

export interface ReferenceData {
  version: string;
  medicalNeeds: MedicalNeed[];
  sources: Source[];
  schemes: Scheme[];
  treatments: SchemeTreatment[];
  rules: EligibilityRule[];
  documents: SchemeDocument[];
  hospitals: Hospital[];
  schemeHospitals: SchemeHospital[];
}

/* ---------------------------- Person / search ---------------------------- */

export type SocialCategory = "general" | "obc" | "sc" | "st" | "ews" | "other" | "prefer_not_to_say";
export type TriState = "yes" | "no" | "not_sure";
export type PmjayStatus = "has_card" | "listed" | "not_listed" | "not_sure";
export type SearchMode = "profile" | "open";

export interface IncomeInput {
  rangeId: string | null; // id from income ranges config
  exactInr: number | null;
}

export interface InsuranceInput {
  status: TriState | null;
  insurer: string | null;
  policyType: string | null;
}

export interface TreatmentLocation {
  state: string | null;
  district: string | null;
  cityOrPin: string | null;
  latitude: number | null;
  longitude: number | null;
  source: "manual" | "browser";
}

export interface SearchCriteria {
  needId: string;
  mode: SearchMode;
  age: number | null;
  residenceState: string | null;
  residenceDistrict: string | null;
  income: IncomeInput;
  insurance: InsuranceInput;
  socialCategory: SocialCategory | null;
  pmjayStatus: PmjayStatus | null;
  stateBeneficiaryDocument: TriState | null;
  needDetails: Record<string, string>;
  treatmentLocation: TreatmentLocation;
}

/* -------------------------------- Results -------------------------------- */

export type RuleOutcome = "MATCH" | "DOES_NOT_MATCH" | "UNKNOWN";
export type RuleDisplayStatus = "meets" | "does_not_meet" | "missing_info" | "requires_verification";

export interface RuleEvaluation {
  ruleId: string;
  criterion: Criterion;
  outcome: RuleOutcome;
  display: RuleDisplayStatus;
  officialText: string;
  reason: string; // platform-generated explanation
  mandatory: boolean;
  anyOfGroup: string | null;
  sourceId: string | null;
}

export type OverallStatus = "potential_match" | "needs_verification" | "does_not_match";

export interface RankedHospital {
  hospital: Hospital;
  links: SchemeHospital[];
  distanceKm: number | null;
  proximity: "distance" | "same_district" | "same_state" | "other";
  treatmentConfirmed: boolean;
}

export interface SchemeResult {
  scheme: Scheme;
  treatment: SchemeTreatment;
  overall: OverallStatus;
  summaryReason: string;
  evaluations: RuleEvaluation[];
  documents: SchemeDocument[];
  hospitals: RankedHospital[];
  sources: Source[];
}

export interface OfficialResource {
  label: string;
  url: string;
}
