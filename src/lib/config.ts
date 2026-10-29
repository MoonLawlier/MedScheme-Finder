/**
 * Runtime configuration. Only NEXT_PUBLIC_* values are ever sent to the
 * browser. The service-role key is used solely by scripts/seed.ts and is never
 * imported by application code.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

/**
 * Development fallback: when Supabase is not configured, the app uses a local
 * file-backed store and a clearly labelled development sign-in. It is never
 * enabled in production unless ALLOW_DEV_FALLBACK=true is set deliberately
 * (e.g. for an offline demo), and the UI labels it on every page.
 */
export const isDevFallback =
  !isSupabaseConfigured &&
  (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_FALLBACK === "true");

/** Supabase can't tell the browser which providers are enabled, so these are explicit flags. */
export const authProviders = {
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true",
  phone: process.env.NEXT_PUBLIC_AUTH_PHONE_ENABLED === "true",
};

export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export type BackendMode = "supabase" | "dev" | "unconfigured";
export const backendMode: BackendMode = isSupabaseConfigured ? "supabase" : isDevFallback ? "dev" : "unconfigured";
