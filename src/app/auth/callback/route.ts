import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { backendMode } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Completes Supabase sign-in for magic links (token_hash) and OAuth / PKCE
 * flows (code). Errors send the user back to sign-in with a readable reason.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/dashboard";
  const fail = (reason: string) => NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(reason)}`);

  if (backendMode !== "supabase") return fail("not_configured");

  const supabase = await createSupabaseServerClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("link_invalid");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail("link_invalid");
  } else {
    return fail(searchParams.get("error_description") ? "provider_error" : "link_invalid");
  }
  return NextResponse.redirect(`${origin}${next}`);
}
