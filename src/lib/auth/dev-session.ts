import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * DEVELOPMENT-ONLY session. Used when Supabase is not configured so the full
 * journey can be demonstrated locally. It performs NO identity verification:
 * whoever types an email is signed in as that email. The UI labels it as such
 * and it is disabled in production unless ALLOW_DEV_FALLBACK=true.
 */
export const DEV_SESSION_COOKIE = "msf_dev_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

const DEV_ONLY_SECRET = "development-only-secret-change-me";

/**
 * Outside production a built-in secret keeps local demos zero-config. In
 * production (only reachable with ALLOW_DEV_FALLBACK=true) a well-known default
 * would let anyone mint a valid session, so DEV_SESSION_SECRET is mandatory.
 */
function secret(): string | null {
  const configured = process.env.DEV_SESSION_SECRET;
  if (configured && configured.length >= 16) return configured;
  return process.env.NODE_ENV === "production" ? null : DEV_ONLY_SECRET;
}

/** Deterministic UUID-shaped id from the email, so data persists across restarts. */
export function devUserIdForEmail(email: string): string {
  const h = createHash("sha256").update(`msf-dev:${email.toLowerCase()}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export interface DevSession {
  uid: string;
  email: string;
  exp: number;
}

export function signDevSession(email: string): { value: string; maxAge: number } {
  const key = secret();
  if (!key) throw new Error("DEV_SESSION_SECRET (16+ characters) is required when the dev fallback runs in production.");
  const payload: DevSession = {
    uid: devUserIdForEmail(email),
    email: email.toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", key).update(body).digest("base64url");
  return { value: `${body}.${sig}`, maxAge: MAX_AGE_SECONDS };
}

export function verifyDevSession(value: string | undefined): DevSession | null {
  if (!value) return null;
  const key = secret();
  if (!key) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = createHmac("sha256", key).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as DevSession;
    if (
      typeof payload.uid !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now() / 1000
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
