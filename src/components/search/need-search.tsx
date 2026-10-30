"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { findSupportedNeed } from "@/lib/needs/search";
import type { MedicalNeed } from "@/lib/types";

export function NeedSearch({ needs }: { needs: MedicalNeed[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const need = findSupportedNeed(query, needs);
    if (!need) {
      setError(
        "We don't have verified scheme data for that condition or treatment yet, so we can't assess it.",
      );
      return;
    }

    router.push(`/search/${encodeURIComponent(need.id)}`);
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-4">
      <Field
        id="medical-need"
        label="Condition or treatment"
        required
        hint="Enter the condition or treatment you need help with."
        error={error ?? undefined}
      >
        <Input
          id="medical-need"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (error) setError(null);
          }}
          aria-invalid={Boolean(error)}
          required
        />
      </Field>
      <Button type="submit">Continue</Button>
    </form>
  );
}
