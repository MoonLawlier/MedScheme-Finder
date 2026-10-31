import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { safeNext } from "@/lib/auth/safe-next";
import { devUserIdForEmail, signDevSession, verifyDevSession } from "@/lib/auth/dev-session";

describe("safeNext (post-sign-in redirect target)", () => {
  it("keeps same-site paths, query strings and hashes", () => {
    expect(safeNext("/profile")).toBe("/profile");
    expect(safeNext("/search/knee-replacement?x=1#top")).toBe("/search/knee-replacement?x=1#top");
  });

  it.each([
    "//evil.example",
    "/\\evil.example",
    "/\\/evil.example",
    "/\t/evil.example",
    "/\n/evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "evil.example",
    "",
    undefined,
    null,
    42,
  ])("rejects %j", (bad) => {
    expect(safeNext(bad)).toBe("/dashboard");
  });

  it("rejects absurdly long values and honours a custom fallback", () => {
    expect(safeNext(`/${"a".repeat(3000)}`)).toBe("/dashboard");
    expect(safeNext("//x", "/")).toBe("/");
  });
});

describe("dev session cookie", () => {
  const original = { ...process.env };
  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = { ...original };
  });

  it("round-trips a signed session and lower-cases the email", () => {
    const { value } = signDevSession("Person@Example.TEST");
    const s = verifyDevSession(value);
    expect(s?.email).toBe("person@example.test");
    expect(s?.uid).toBe(devUserIdForEmail("person@example.test"));
  });

  it("rejects missing, malformed, tampered and wrongly-signed values", () => {
    const { value } = signDevSession("a@example.test");
    const [body, sig] = value.split(".");
    expect(verifyDevSession(undefined)).toBeNull();
    expect(verifyDevSession("")).toBeNull();
    expect(verifyDevSession("garbage")).toBeNull();
    expect(verifyDevSession(`${body}.`)).toBeNull();
    expect(verifyDevSession(`${value}.extra`)).toBeNull();
    const forgedBody = Buffer.from(JSON.stringify({ uid: "x", email: "b@example.test", exp: 9e9 })).toString("base64url");
    expect(verifyDevSession(`${forgedBody}.${sig}`)).toBeNull();
    const wrongKey = createHmac("sha256", "not-the-key").update(forgedBody).digest("base64url");
    expect(verifyDevSession(`${forgedBody}.${wrongKey}`)).toBeNull();
  });

  it("rejects expired sessions", () => {
    vi.useFakeTimers();
    try {
      const { value, maxAge } = signDevSession("a@example.test");
      expect(verifyDevSession(value)).not.toBeNull();
      vi.setSystemTime(Date.now() + (maxAge + 5) * 1000);
      expect(verifyDevSession(value)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects a validly signed payload that lacks a numeric expiry", () => {
    const body = Buffer.from(JSON.stringify({ uid: "x", email: "a@example.test" })).toString("base64url");
    const sig = createHmac("sha256", "development-only-secret-change-me").update(body).digest("base64url");
    expect(verifyDevSession(`${body}.${sig}`)).toBeNull();
  });

  it("refuses to sign or verify in production without a real DEV_SESSION_SECRET", () => {
    const { value } = signDevSession("a@example.test");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_SESSION_SECRET", "");
    expect(() => signDevSession("a@example.test")).toThrow(/DEV_SESSION_SECRET/);
    expect(verifyDevSession(value)).toBeNull();
    vi.stubEnv("DEV_SESSION_SECRET", "short");
    expect(() => signDevSession("a@example.test")).toThrow();
  });

  it("works in production once a strong secret is configured, and keys differ per secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_SESSION_SECRET", "a-long-random-secret-value-1");
    const { value } = signDevSession("a@example.test");
    expect(verifyDevSession(value)?.email).toBe("a@example.test");
    vi.stubEnv("DEV_SESSION_SECRET", "a-different-long-secret-2");
    expect(verifyDevSession(value)).toBeNull();
  });
});
