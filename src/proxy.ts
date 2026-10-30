import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEV_SESSION_COOKIE, verifyDevSession } from "@/lib/auth/dev-session";
import { safeNext } from "@/lib/auth/safe-next";

const PROTECTED = ["/dashboard", "/profile", "/search", "/results", "/history"];

/**
 * Refreshes the Supabase session cookie and sends signed-out visitors on
 * protected pages to sign-in. This is an optimistic check only — every page
 * and server action verifies the user again on the server.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isProtected = PROTECTED.some((p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`));

  let response = NextResponse.next({ request });
  let signedIn = false;

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          // Responses that carry refreshed auth cookies must never be cached by a CDN/browser.
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    signedIn = Boolean(data.user);
  } else {
    // Verify the signature and expiry here too; a bare cookie must not count as signed in.
    signedIn = verifyDevSession(request.cookies.get(DEV_SESSION_COOKIE)?.value) !== null;
  }

  if (isProtected && !signedIn) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = "/sign-in";
    signIn.search = `?next=${encodeURIComponent(safeNext(`${request.nextUrl.pathname}${request.nextUrl.search}`))}`;
    return NextResponse.redirect(signIn);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
