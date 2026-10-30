import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Suspense } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { brand } from "@/config/brand";
import { backendMode } from "@/lib/config";
import { ModeProvider } from "@/components/layout/mode-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.tagline,
  robots: { index: false }, // MVP: keep out of search engines until data is fully verified
};

export const viewport: Viewport = { themeColor: "#12304a", width: "device-width", initialScale: 1 };

function EnvironmentBanner() {
  if (backendMode === "supabase" || backendMode === "dev") return null;
  return (
    <div className="bg-bad-wash px-4 py-2 text-center text-[0.8125rem] text-ink" role="alert">
      <strong>This deployment isn&apos;t configured.</strong> The database and sign-in are unavailable until Supabase
      environment variables are set.
    </div>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-ink px-3 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to content
        </a>
        <ModeProvider>
          <EnvironmentBanner />
          <Suspense fallback={<div className="h-16 border-b border-line bg-surface" />}>
            <SiteHeader />
          </Suspense>
          <main id="main" className="flex-1">
            {children}
          </main>
          <footer className="mt-16 border-t border-line bg-surface">
            <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-muted sm:px-6 md:grid-cols-[1fr_auto]">
              <div className="max-w-2xl space-y-2">
                <Logo />
                <p>
                  {brand.name} helps you discover and understand government medical assistance. It does not decide
                  eligibility, replace official verification or hospital authorisation, or give medical advice.
                </p>
              </div>
              <nav aria-label="Footer" className="flex gap-4 md:flex-col md:items-end">
                <Link href="/help" className="hover:text-ink">
                  How it works
                </Link>
                <Link href="/help#privacy" className="hover:text-ink">
                  Privacy
                </Link>
                <Link href="/help#sources" className="hover:text-ink">
                  Data sources
                </Link>
              </nav>
            </div>
          </footer>
        </ModeProvider>
      </body>
    </html>
  );
}
