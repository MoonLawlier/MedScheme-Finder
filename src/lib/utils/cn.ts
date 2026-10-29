import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatInr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Indian-style short amounts: ₹5 lakh, ₹1.25 lakh, ₹15 lakh. */
export function formatInrShort(n: number): string {
  if (n >= 10_000_000) return `₹${+(n / 10_000_000).toFixed(2)} crore`;
  if (n >= 100_000) return `₹${+(n / 100_000).toFixed(2)} lakh`;
  return formatInr(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Not available";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

/** Age in whole years on `today`, from an ISO date of birth. */
export function ageFromDob(dob: string | null | undefined, today: Date = new Date()): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

/** Only allow http(s) links to be rendered as external anchors. */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function isGovDomain(url: string | null | undefined): boolean {
  const safe = safeExternalUrl(url);
  if (!safe) return false;
  const host = new URL(safe).hostname;
  return host.endsWith(".gov.in") || host.endsWith(".nic.in");
}
