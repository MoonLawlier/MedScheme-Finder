"use client";
import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";
import { MODE_KEY, clearOpenModeData } from "@/lib/client/session-store";
import type { SearchMode } from "@/lib/types";

interface ModeContextValue {
  mode: SearchMode;
  setMode: (m: SearchMode) => void;
}

const ModeContext = createContext<ModeContextValue | null>(null);
const listeners = new Set<() => void>();

function read(): SearchMode {
  try {
    return window.sessionStorage.getItem(MODE_KEY) === "open" ? "open" : "profile";
  } catch {
    return "profile";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * The "According to your profile" / "Open mode" choice. It changes the data
 * flow, not just the look: the search form prefills from the saved profile
 * only in profile mode, and leaving Open mode clears that person's details.
 */
export function ModeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, read, () => "profile" as SearchMode);
  const setMode = useCallback((next: SearchMode) => {
    const prev = read();
    if (prev === next) return;
    if (prev === "open") clearOpenModeData();
    try {
      window.sessionStorage.setItem(MODE_KEY, next);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  }, []);
  return <ModeContext.Provider value={{ mode, setMode }}>{children}</ModeContext.Provider>;
}

const noopSubscribe = () => () => {};

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error("useMode must be used inside ModeProvider");
  // The provider can switch to the stored mode before a consumer inside a later
  // Suspense boundary hydrates. Report the server value ("profile") during each
  // consumer's own hydration so its markup matches, then the real mode.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return hydrated ? ctx : { mode: "profile", setMode: ctx.setMode };
}

export function ModeToggle({ size = "sm", className }: { size?: "sm" | "lg"; className?: string }) {
  const { mode, setMode } = useMode();
  const options: { value: SearchMode; label: string; long: string }[] = [
    { value: "profile", label: "My profile", long: "According to your profile" },
    { value: "open", label: "Someone else", long: "Open mode — for someone else" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Who are you searching for?"
      className={`inline-flex rounded-full border border-line-strong bg-surface p-0.5 ${className ?? ""}`}
    >
      {options.map((o) => {
        const active = mode === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                e.preventDefault();
                setMode(o.value === "profile" ? "open" : "profile");
              }
            }}
            tabIndex={active ? 0 : -1}
            className={`rounded-full font-medium transition-colors ${size === "lg" ? "px-4 py-2 text-sm sm:text-[0.95rem]" : "px-3 py-1 text-xs sm:text-sm"} ${
              active ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {size === "lg" ? o.long : o.label}
          </button>
        );
      })}
    </div>
  );
}
