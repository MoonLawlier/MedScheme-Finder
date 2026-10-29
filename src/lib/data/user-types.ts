import type { PmjayStatus, SearchMode, SocialCategory, TriState } from "@/lib/types";

export interface Address {
  line: string;
  state: string;
  district: string;
  pin: string;
}

export interface Profile {
  userId: string;
  fullName: string;
  dateOfBirth: string; // ISO date — the single source of truth for age
  phoneNumber: string | null;
  religion: string | null;
  socialCategory: SocialCategory | null;
  permanentAddress: Address;
  currentSameAsPermanent: boolean;
  currentAddress: Address | null;
  incomeConsent: boolean;
  incomeRangeId: string | null;
  incomeExactInr: number | null;
  insuranceStatus: TriState | null;
  insuranceInsurer: string | null;
  insurancePolicyType: string | null;
  pmjayStatus: PmjayStatus | null;
  stateBeneficiaryDocument: TriState | null;
  updatedAt: string;
}

export interface SearchRecord {
  id: string;
  userId: string;
  needId: string;
  mode: SearchMode;
  /** Treatment state only for profile-mode searches; null for open mode. */
  treatmentState: string | null;
  resultCounts: { potential_match: number; needs_verification: number; does_not_match: number };
  referenceVersion: string;
  createdAt: string;
}

export type InteractionAction = "opened" | "application_link_clicked";

export interface InteractionRecord {
  id: string;
  userId: string;
  searchId: string | null;
  schemeId: string;
  action: InteractionAction;
  createdAt: string;
}

export type ApplicationStatus = "planning" | "applied" | "approved" | "rejected" | "withdrawn";

export interface ApplicationStatusRecord {
  userId: string;
  schemeId: string;
  status: ApplicationStatus;
  updatedAt: string;
}

export interface UserStore {
  getProfile(userId: string): Promise<Profile | null>;
  upsertProfile(userId: string, data: Omit<Profile, "userId" | "updatedAt">): Promise<Profile>;
  createSearch(userId: string, rec: Omit<SearchRecord, "id" | "userId" | "createdAt">): Promise<SearchRecord>;
  listSearches(userId: string, limit?: number): Promise<SearchRecord[]>;
  recordInteraction(userId: string, rec: Omit<InteractionRecord, "id" | "userId" | "createdAt">): Promise<void>;
  listInteractions(userId: string, limit?: number): Promise<InteractionRecord[]>;
  setApplicationStatus(userId: string, schemeId: string, status: ApplicationStatus | null): Promise<void>;
  listApplicationStatuses(userId: string): Promise<ApplicationStatusRecord[]>;
}
