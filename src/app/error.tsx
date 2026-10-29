"use client";
import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/feedback";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Only the digest is logged: error messages could contain user data.
    console.error("Page error", error.digest ?? "no-digest");
  }, [error]);
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Panel className="space-y-4 text-center">
        <h1 className="text-2xl font-semibold">This page didn&apos;t load</h1>
        <p className="text-ink-soft">
          Something went wrong on our side or the connection dropped. Nothing you entered has been shared. Try again, or go back to Find
          schemes.
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink href="/dashboard" variant="secondary">
            Find schemes
          </ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
