import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { backendMode } from "@/lib/config";
import { DEV_SESSION_COOKIE, verifyDevSession } from "@/lib/auth/dev-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
  phone: string | null;
  /** True only when the auth provider confirmed the phone (e.g. SMS OTP). */
  phoneVerified: boolean;
  authMode: "supabase" | "dev";
}

/** Server-verified current user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  // Always request-time: auth must never be baked into a prerendered page.
  await connection();
  if (backendMode === "supabase") {
    const supabase = await createSupabaseServerClient();
    // getUser() validates the JWT with Supabase Auth rather than trusting the cookie.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const u = data.user;
    return {
      id: u.id,
      email: u.email ?? null,
      phone: u.phone ? `+${u.phone.replace(/^\+/, "")}` : null,
      phoneVerified: Boolean(u.phone && u.phone_confirmed_at),
      authMode: "supabase",
    };
  }
  if (backendMode === "dev") {
    const session = verifyDevSession((await cookies()).get(DEV_SESSION_COOKIE)?.value);
    if (!session) return null;
    return { id: session.uid, email: session.email, phone: null, phoneVerified: false, authMode: "dev" };
  }
  return null;
});

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : "/sign-in");
  return user;
}
