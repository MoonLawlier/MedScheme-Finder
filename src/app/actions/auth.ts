"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { backendMode } from "@/lib/config";
import { DEV_SESSION_COOKIE, signDevSession } from "@/lib/auth/dev-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const safeNext = (next: unknown) =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

export interface DevSignInState {
  error: string | null;
}

/** DEVELOPMENT ONLY — refuses to run when Supabase is configured or in production. */
export async function devSignIn(_prev: DevSignInState, formData: FormData): Promise<DevSignInState> {
  if (backendMode !== "dev") return { error: "Development sign-in is disabled on this deployment." };
  const parsed = z.string().trim().email().max(200).safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const { value, maxAge } = signDevSession(parsed.data);
  (await cookies()).set(DEV_SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  redirect(safeNext(formData.get("next")));
}

export async function signOut(): Promise<void> {
  if (backendMode === "supabase") {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(DEV_SESSION_COOKIE);
  redirect("/");
}
