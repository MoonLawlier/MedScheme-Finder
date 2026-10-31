"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import type { MedicalNeed } from "@/lib/types";

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function findNeed(name: string, needs: MedicalNeed[]) {
  const normalized = normalizeName(name);
  return needs.find((need) => {
    const acceptedNames = [need.name, need.id.replace(/-/g, " ")];
    if (need.id === "leukemia") acceptedNames.push("leukemia");
    return acceptedNames.some((accepted) => normalizeName(accepted) === normalized);
  });
}

export function NeedNameInput({
  needs,
  initialNeedId,
  buttonLabel = "Continue",
}: {
  needs: MedicalNeed[];
  initialNeedId?: string;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const initialNeed = needs.find((need) => need.id === initialNeedId);
  const [name, setName] = useState(initialNeed?.name ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  function chooseNeed() {
    const trimmed = name.trim();
    if (!trimmed) {
      inputRef.current?.reportValidity();
      return;
    }

    const need = findNeed(trimmed, needs);
    if (!need) {
      window.alert("This disease is not recognized in the system.");
      return;
    }
    router.push(`/search/${need.id}`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      chooseNeed();
    }
  }

  return (
    <div className="space-y-3">
      <Field id="medical-need-name" label="Disease or treatment name" required>
        <Input
          ref={inputRef}
          id="medical-need-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={onKeyDown}
          autoComplete="off"
          required
          placeholder="Enter a disease or treatment"
        />
      </Field>
      <Button type="button" onClick={chooseNeed}>
        {buttonLabel}
      </Button>
    </div>
  );
}
