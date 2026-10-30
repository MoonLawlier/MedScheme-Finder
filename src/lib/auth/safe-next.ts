/**
 * Post-sign-in redirect targets must stay on this site. Browsers treat "\" like
 * "/" and strip tabs/newlines inside URLs, so "/\evil.example" or "/\t/evil.example"
 * would otherwise become the protocol-relative URL "//evil.example".
 * Pure (no server-only imports) so the proxy, server code and client code share it.
 */
export const DEFAULT_NEXT = "/dashboard";

export function safeNext(value: unknown, fallback: string = DEFAULT_NEXT): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Backslashes and ASCII control characters (incl. tab/CR/LF) are parsed away or re-interpreted by browsers.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "http://safe-next.invalid");
    if (parsed.origin !== "http://safe-next.invalid") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
