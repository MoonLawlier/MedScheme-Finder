"use client";
import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { signOut } from "@/app/actions/auth";
import { clearAllSessionData } from "@/lib/client/session-store";
import { cn } from "@/lib/utils/cn";

export function SignOutButton({ className }: { className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          // Search details live only in this tab's session storage; wipe them first.
          clearAllSessionData();
          await signOut();
        })
      }
      className={cn("inline-flex items-center gap-2 text-sm font-medium text-ink-soft hover:text-ink", className)}
    >
      <LogOut className="size-4" aria-hidden />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
