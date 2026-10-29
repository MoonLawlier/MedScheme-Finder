"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

export function NavLinks({ links, vertical }: { links: { href: string; label: string }[]; vertical?: boolean }) {
  const pathname = usePathname();
  return (
    <ul className={cn("flex gap-1", vertical && "flex-col")}>
      {links.map((l) => {
        const active =
          pathname === l.href ||
          (l.href === "/dashboard" && (pathname.startsWith("/search") || pathname.startsWith("/results")));
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-teal-wash text-teal-strong" : "text-ink-soft hover:bg-paper hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
