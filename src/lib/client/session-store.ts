"use client";
/**
 * Browser-session storage for in-progress searches. Search details (which may
 * include health information or another person's details) are kept in
 * sessionStorage only — never in URLs — and are cleared on sign-out, on
 * "Reset", and when leaving Open mode.
 */
import type { OfficialResource, SchemeResult, SearchCriteria, SearchMode } from "@/lib/types";

const PREFIX = "msf.";
export const MODE_KEY = `${PREFIX}mode`;
const RESULTS_KEY = `${PREFIX}results.v1`;
const draftKey = (mode: SearchMode, needId: string) => `${PREFIX}draft.${mode}.${needId}`;

export interface StoredResults {
  searchId: string | null;
  needId: string;
  needName: string;
  mode: SearchMode;
  criteria: SearchCriteria;
  results: SchemeResult[];
  referenceVersion: string;
  createdAt: string;
  historyWarning: string | null;
  officialResources: OfficialResource[];
}

function safeGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode / quota) — the app still works without it */
  }
}
function safeRemove(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadDraft<T>(mode: SearchMode, needId: string): T | null {
  const raw = safeGet(draftKey(mode, needId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
export const saveDraft = (mode: SearchMode, needId: string, draft: unknown) =>
  safeSet(draftKey(mode, needId), JSON.stringify(draft));
export const clearDraft = (mode: SearchMode, needId: string) => safeRemove(draftKey(mode, needId));

export function loadResults(): StoredResults | null {
  const raw = safeGet(RESULTS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredResults;
  } catch {
    return null;
  }
}
export const saveResults = (r: StoredResults) => safeSet(RESULTS_KEY, JSON.stringify(r));
export const clearResults = () => safeRemove(RESULTS_KEY);

/** Remove everything entered in Open mode (another person's details). */
export function clearOpenModeData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k?.startsWith(`${PREFIX}draft.open.`)) keys.push(k);
    }
    keys.forEach(safeRemove);
    if (loadResults()?.mode === "open") clearResults();
  } catch {
    /* ignore */
  }
}

export function clearAllSessionData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach(safeRemove);
  } catch {
    /* ignore */
  }
}
