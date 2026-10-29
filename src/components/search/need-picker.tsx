"use client";
import Link from "next/link";
import { Activity, Bone, HeartPulse, Stethoscope } from "lucide-react";
import { ModeToggle, useMode } from "@/components/layout/mode-provider";
import type { MedicalNeed } from "@/lib/types";
import { cn } from "@/lib/utils/cn";

const icons: Record<string, typeof Bone> = {
  "knee-replacement": Bone,
  leukemia: Activity,
  angioplasty: HeartPulse,
};

const kindLabel = { procedure: "Procedure", disease: "Condition", both: "Condition and procedure" } as const;

export function NeedPicker({ needs, compact = false, activeId }: { needs: MedicalNeed[]; compact?: boolean; activeId?: string }) {
  const { mode } = useMode();
  return (
    <ul className={cn("grid gap-3", compact ? "sm:grid-cols-3" : "md:grid-cols-3")}>
      {needs.map((n) => {
        const Icon = icons[n.id] ?? Stethoscope;
        const active = n.id === activeId;
        return (
          <li key={n.id}>
            <Link
              href={`/search/${n.id}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-full flex-col rounded-2xl border bg-surface transition-colors",
                compact ? "flex-row items-center gap-3 px-4 py-3" : "gap-3 p-5",
                active ? "border-teal ring-1 ring-teal" : "border-line hover:border-teal",
              )}
            >
              <span className={cn("flex items-center justify-center rounded-xl bg-teal-wash text-teal-strong", compact ? "size-9" : "size-11")}>
                <Icon className={compact ? "size-4.5" : "size-5"} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className={cn("block font-display font-semibold text-ink", compact ? "text-base" : "text-xl")}>{n.name}</span>
                {!compact && (
                  <>
                    <span className="mt-0.5 block text-xs font-medium text-muted">
                      {kindLabel[n.kind]}, {n.specialty.toLowerCase()}
                    </span>
                    <span className="mt-2 block text-sm text-ink-soft">{n.summary}</span>
                    <span className="mt-3 block text-sm font-semibold text-teal group-hover:underline">
                      {mode === "open" ? "Search for someone else" : "Search with my profile"}
                    </span>
                  </>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function WhoAreYouSearchingFor() {
  const { mode } = useMode();
  return (
    <div className="space-y-3">
      <h2 className="text-2xl font-semibold">Who are you searching for?</h2>
      <ModeToggle size="lg" />
      <p className="max-w-prose text-sm text-ink-soft" aria-live="polite">
        {mode === "profile"
          ? "We'll prefill your saved details. Anything you change in a search stays in that search unless you choose to save it to your profile."
          : "Enter another person's details. Nothing is copied from or saved to your profile, and their details are cleared when you leave Open mode or sign out."}
      </p>
    </div>
  );
}
