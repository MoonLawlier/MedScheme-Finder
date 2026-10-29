"use client";
import { useState, useTransition } from "react";
import { setApplicationStatus } from "@/app/actions/search";
import { Select } from "@/components/ui/form";
import type { ApplicationStatus } from "@/lib/data/user-types";

const OPTIONS: { value: ApplicationStatus | ""; label: string }[] = [
  { value: "", label: "Not recorded" },
  { value: "planning", label: "Planning to apply" },
  { value: "applied", label: "Applied" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Not approved" },
  { value: "withdrawn", label: "Withdrawn" },
];

/** Application status is only ever what the user records here. */
export function StatusSelect({ schemeId, schemeName, initial }: { schemeId: string; schemeName: string; initial: ApplicationStatus | null }) {
  const [value, setValue] = useState<string>(initial ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`status-${schemeId}`} className="text-sm text-muted">
        Your status
      </label>
      <Select
        id={`status-${schemeId}`}
        aria-label={`Your application status for ${schemeName}`}
        className="w-auto py-1.5"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          const prev = value;
          setValue(next);
          setMessage(null);
          start(async () => {
            const res = await setApplicationStatus({ schemeId, status: next || null });
            if (!res.ok) {
              setValue(prev);
              setMessage(res.error ?? "Couldn't save.");
            } else setMessage("Saved");
          });
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
      {message && (
        <span role="status" className={`text-xs ${message === "Saved" ? "text-ok" : "text-bad"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
