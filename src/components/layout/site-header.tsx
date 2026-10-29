import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { ModeToggle } from "@/components/layout/mode-provider";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Logo } from "@/components/layout/logo";
import { NavLinks } from "@/components/layout/nav-links";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { buttonClass } from "@/components/ui/button";

const links = [
  { href: "/dashboard", label: "Find schemes" },
  { href: "/profile", label: "My profile" },
  { href: "/history", label: "Scheme history" },
  { href: "/help", label: "Help" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href={user ? "/dashboard" : "/"} className="shrink-0 rounded-md">
          <Logo />
          <span className="sr-only">Home</span>
        </Link>

        {user ? (
          <>
            <nav aria-label="Main" className="ml-4 hidden lg:block">
              <NavLinks links={links} />
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <div className="hidden sm:block">
                <ModeToggle />
              </div>
              <SignOutButton className="hidden lg:inline-flex" />
              <MobileMenu>
                <div className="mb-3 sm:hidden">
                  <p className="mb-1.5 text-xs font-medium text-muted">Searching for</p>
                  <ModeToggle />
                </div>
                <nav aria-label="Main mobile">
                  <NavLinks links={links} vertical />
                </nav>
                <div className="mt-2 border-t border-line pt-3">
                  <SignOutButton />
                </div>
              </MobileMenu>
            </div>
          </>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <Link href="/help" className="hidden px-2 text-sm font-medium text-ink-soft hover:text-ink sm:inline">
              How it works
            </Link>
            <Link href="/sign-in" className={buttonClass("primary", "sm")}>
              Sign in
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
